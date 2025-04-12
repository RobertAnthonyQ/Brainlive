#!/usr/bin/env python3
"""
Script para controlar la visualización del cerebro Neo4j mediante la API
"""

import requests
import json
import argparse
import time
import sys

# URL del servidor
DEFAULT_SERVER_URL = "http://localhost:3000/api/brain"

def activar_nodos(node_data, append=False, server_url=DEFAULT_SERVER_URL):
    """Activa nodos específicos en la visualización"""
    endpoint = f"{server_url}/activate"
    
    # Convertir la lista de tuplas a lista de diccionarios
    nodes = [{"id": id, "name": name} for id, name in node_data]
    
    data = {
        "nodes": nodes,
        "append": append
    }
    
    try:
        print(f"Enviando petición a {endpoint}")
        print(f"Datos: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        response = requests.post(endpoint, json=data)
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Nodos activados")
            print(f"Estado: {result}")
            
            # Destacar cuáles nodos fueron activados
            if result.get('activeNodes'):
                print("\nNodos activos:")
                active_nodes = result['activeNodes']
                for node in nodes:
                    node_id = node['id']
                    mark = '➤' if node_id in active_nodes else ' '
                    print(f" {mark} {node_id} - {node['name']}")
                    
                # Verificar si hay nodos que no se encontraron
                activated_ids = set(active_nodes)
                requested_ids = {node['id'] for node in nodes}
                missing = requested_ids - activated_ids
                if missing:
                    print("\n⚠️ Advertencia: Algunos nodos solicitados no fueron activados:")
                    missing_nodes = [n for n in nodes if n['id'] in missing]
                    for node in missing_nodes:
                        print(f"  {node['id']} - {node['name']}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

def reiniciar(server_url=DEFAULT_SERVER_URL):
    """Reinicia la visualización"""
    endpoint = f"{server_url}/reset"
    
    try:
        print(f"Enviando petición a {endpoint}")
        response = requests.post(endpoint)
        
        if response.status_code == 200:
            print("\n✅ Visualización reiniciada")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

def verificar_estado(server_url=DEFAULT_SERVER_URL):
    """Verifica el estado actual de la visualización"""
    endpoint = f"{server_url}/status"
    
    try:
        print(f"Enviando petición a {endpoint}")
        response = requests.get(endpoint)
        
        if response.status_code == 200:
            result = response.json()
            active_nodes = result.get('activeNodes', [])
            
            print("\n✅ Estado actual:")
            if active_nodes:
                print(f"\nHay {len(active_nodes)} nodos activos:")
                for i, node in enumerate(active_nodes):
                    node_id = node['id'] if isinstance(node, dict) else node
                    node_name = node.get('name', 'Sin nombre') if isinstance(node, dict) else 'Sin nombre'
                    print(f" {i+1}. {node_id} - {node_name}")
            else:
                print("\nNo hay nodos activos actualmente")
                
            # Modo detallado
            print("\nRespuesta completa:")
            print(json.dumps(result, indent=2))
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Control de la visualización Neo4j")
    parser.add_argument("--server", "-s", default=DEFAULT_SERVER_URL,
                        help=f"URL del servidor (default: {DEFAULT_SERVER_URL})")
    
    subparsers = parser.add_subparsers(dest="comando", help="Comando a ejecutar")
    
    # Comando para activar nodos
    activar_parser = subparsers.add_parser("activar", help="Activar nodos específicos")
    activar_parser.add_argument("--nodes", "-n", nargs="+", required=True,
                               help="Nodos a activar en formato 'id:nombre' (ej: '144:Visual' '145:Motor')")
    activar_parser.add_argument("--append", "-a", action="store_true",
                               help="Añadir a los nodos activos en vez de reemplazarlos")
    
    # Comando para reiniciar
    subparsers.add_parser("reiniciar", help="Reiniciar visualización")
    
    # Comando para verificar estado
    subparsers.add_parser("estado", help="Verificar estado actual")
    
    # Validar argumentos
    args = parser.parse_args()
    
    # Si no se especificó ningún comando, mostrar ayuda
    if not args.comando:
        parser.print_help()
        sys.exit(1)
    
    # Ejecutar el comando especificado
    if args.comando == "activar":
        # Procesar los nodos del formato "id:nombre"
        try:
            node_data = []
            for node_str in args.nodes:
                node_id, *name_parts = node_str.split(':')
                name = ':'.join(name_parts) if name_parts else f"Neuron {node_id}"
                node_data.append((node_id, name))
            activar_nodos(node_data, args.append, args.server)
        except ValueError as e:
            print("❌ Error: Formato de nodo inválido. Use 'id:nombre' (ej: '144:Visual')")
            sys.exit(1)
    elif args.comando == "reiniciar":
        reiniciar(args.server)
    elif args.comando == "estado":
        verificar_estado(args.server)
    else:
        parser.print_help() 