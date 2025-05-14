from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import os
from pathlib import Path
from dotenv import load_dotenv

# Configurações
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Configuração do MySQL
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'navas'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'connect_timeout': 10
}

def get_db_connection():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        print(f"Erro na conexão com MySQL: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(os.path.join(app.static_folder, 'images'), filename)

@app.route('/api/products/search', methods=['POST'])
def search_product():
    connection = None
    try:
        data = request.get_json()
        codigo = data.get('codigo', '').strip()
        
        if not codigo:
            return jsonify({"error": "Código não fornecido"}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT p.id, p.descricao, p.preco_sp as preco, p.imagem_path
            FROM produtos p
            JOIN produto_codigos pc ON p.id = pc.produto_id
            WHERE pc.codigo = %s
        """, (codigo,))

        product = cursor.fetchone()
        if not product:
            return jsonify({"error": "Produto não encontrado"}), 404

        cursor.execute("""
            SELECT codigo, principal 
            FROM produto_codigos
            WHERE produto_id = %s
            ORDER BY principal DESC
        """, (product['id'],))

        codigos = cursor.fetchall()
        codigo_principal = next((c['codigo'] for c in codigos if c['principal']), None)
        
        codigos_alternativos = []
        codigo_pesquisado_encontrado = False
        
        for c in codigos:
            if c['principal']:
                continue
            if c['codigo'] == codigo:
                codigo_pesquisado_encontrado = True
            codigos_alternativos.append(c['codigo'])
        
        if not codigo_pesquisado_encontrado and codigo != codigo_principal:
            codigos_alternativos.insert(0, codigo)

        img_path = None
        if product['imagem_path']:
            img_name = os.path.basename(product['imagem_path'])
            static_path = Path(app.static_folder) / 'images' / img_name
            if static_path.exists():
                img_path = f"/static/images/{img_name}"

        return jsonify({
            "produto_id": product['id'],
            "codigo_principal": codigo_principal,
            "codigo_pesquisado": codigo,
            "codigos_alternativos": codigos_alternativos,
            "nome": product['descricao'],
            "preco": float(product['preco']),
            "imagem": img_path
        })

    except Exception as e:
        print(f"Erro na busca: {str(e)}")
        return jsonify({"error": "Erro interno no servidor"}), 500
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/products/update_codes', methods=['POST'])
def update_product_codes():
    connection = None
    try:
        data = request.get_json()
        produto_id = data['produto_id']
        codigo_principal = data['codigo_principal']
        codigos_alternativos = data['codigos_alternativos']
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        
        cursor.execute("DELETE FROM produto_codigos WHERE produto_id = %s", (produto_id,))
        
        cursor.execute(
            "INSERT INTO produto_codigos (produto_id, codigo, principal) VALUES (%s, %s, 1)",
            (produto_id, codigo_principal)
        )
        
        for codigo in codigos_alternativos:
            if codigo.strip():
                cursor.execute(
                    "INSERT INTO produto_codigos (produto_id, codigo, principal) VALUES (%s, %s, 0)",
                    (produto_id, codigo)
                )
        
        connection.commit()
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Erro ao atualizar códigos: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/products/update', methods=['POST'])
def update_product():
    connection = None
    try:
        data = request.get_json()
        produto_id = data['produto_id']
        descricao = data['descricao']
        preco = data['preco']
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        
        cursor.execute(
            "UPDATE produtos SET descricao = %s, preco_sp = %s WHERE id = %s",
            (descricao, preco, produto_id)
        )
        
        connection.commit()
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Erro ao atualizar produto: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/products/suggestions', methods=['GET'])
def get_suggestions():
    connection = None
    try:
        search_term = request.args.get('q', '').strip()
        if len(search_term) < 2:
            return jsonify([])
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor(dictionary=True)
        query = """
            SELECT p.id as produto_id, pc.codigo, p.descricao, p.preco_sp as preco, p.imagem_path, pc.principal
            FROM produtos p
            JOIN produto_codigos pc ON p.id = pc.produto_id
            WHERE pc.codigo LIKE %s OR p.descricao LIKE %s
            LIMIT 5
        """
        search_pattern = f"%{search_term}%"
        cursor.execute(query, (search_pattern, search_pattern))

        suggestions = []
        for product in cursor.fetchall():
            img_path = None
            if product['imagem_path']:
                img_name = os.path.basename(product['imagem_path'])
                static_path = Path(app.static_folder) / 'images' / img_name
                if static_path.exists():
                    img_path = f"/static/images/{img_name}"

            suggestions.append({
                "produto_id": product['produto_id'],
                "codigo": product['codigo'],
                "nome": product['descricao'],
                "preco": float(product['preco']),
                "imagem": img_path,
                "principal": bool(product['principal'])
            })

        return jsonify(suggestions)

    except Exception as e:
        print(f"Erro na busca de sugestões: {str(e)}")
        return jsonify([])
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)