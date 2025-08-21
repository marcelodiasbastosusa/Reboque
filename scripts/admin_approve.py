#!/usr/bin/env python3
"""
Script para aprovar usuários pendentes no TowFleets
Uso: python admin_approve.py
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://reboquefacil.preview.emergentagent.com/api"

def admin_login(email, password):
    """Faz login como administrador e retorna o token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login realizado com sucesso como {data['user']['full_name']}")
            return data['access_token']
        else:
            print(f"❌ Erro no login: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Erro ao fazer login: {e}")
        return None

def get_pending_approvals(token):
    """Busca usuários pendentes de aprovação"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/admin/pending-approvals", headers=headers)
        
        if response.status_code == 200:
            users = response.json()
            print(f"\n📋 Encontrados {len(users)} usuários pendentes de aprovação:")
            return users
        else:
            print(f"❌ Erro ao buscar usuários pendentes: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Erro ao buscar aprovações: {e}")
        return []

def approve_user(token, user_id, user_name):
    """Aprova um usuário específico"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{BASE_URL}/admin/approve-user/{user_id}", headers=headers)
        
        if response.status_code == 200:
            print(f"✅ Usuário {user_name} aprovado com sucesso!")
            return True
        else:
            print(f"❌ Erro ao aprovar {user_name}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Erro ao aprovar usuário: {e}")
        return False

def format_user_info(user):
    """Formata informações do usuário para exibição"""
    role_names = {
        'driver': 'Motorista',
        'tow_company': 'Empresa de Reboque',
        'client': 'Cliente',
        'dealer': 'Concessionária',
        'admin': 'Administrador'
    }
    
    created_date = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00')).strftime('%d/%m/%Y %H:%M')
    
    return f"""
    📋 {user['full_name']} ({role_names.get(user['role'], user['role'])})
       📧 Email: {user['email']}
       📱 Telefone: {user.get('phone', 'Não informado')}
       📅 Cadastrado em: {created_date}
       🆔 ID: {user['id']}
    """

def main():
    print("🚛 TowFleets - Aprovação de Usuários")
    print("=" * 50)
    
    # Credenciais do administrador Gabriel
    admin_email = "gabriel@gmail.com"
    admin_password = "@4420Usa2018"
    
    # Fazer login
    token = admin_login(admin_email, admin_password)
    if not token:
        return
    
    # Buscar usuários pendentes
    pending_users = get_pending_approvals(token)
    
    if not pending_users:
        print("\n🎉 Não há usuários pendentes de aprovação!")
        return
    
    # Exibir usuários pendentes
    for i, user in enumerate(pending_users, 1):
        print(f"\n{i}.{format_user_info(user)}")
    
    print("\n" + "=" * 50)
    print("Opções:")
    print("1-{}: Aprovar usuário específico (digite o número)".format(len(pending_users)))
    print("A: Aprovar todos os usuários")
    print("Q: Sair")
    
    while True:
        choice = input("\nEscolha uma opção: ").strip().upper()
        
        if choice == 'Q':
            print("👋 Saindo...")
            break
            
        elif choice == 'A':
            print("\n🔄 Aprovando todos os usuários...")
            approved_count = 0
            for user in pending_users:
                if approve_user(token, user['id'], user['full_name']):
                    approved_count += 1
            
            print(f"\n🎉 {approved_count} de {len(pending_users)} usuários aprovados!")
            break
            
        elif choice.isdigit():
            user_index = int(choice) - 1
            if 0 <= user_index < len(pending_users):
                user = pending_users[user_index]
                print(f"\n🔄 Aprovando {user['full_name']}...")
                
                if approve_user(token, user['id'], user['full_name']):
                    # Remover da lista de pendentes
                    pending_users.pop(user_index)
                    
                    if not pending_users:
                        print("\n🎉 Todos os usuários foram aprovados!")
                        break
                    else:
                        print(f"\n📋 Restam {len(pending_users)} usuários pendentes.")
                        continue
            else:
                print("❌ Opção inválida!")
        else:
            print("❌ Opção inválida!")

if __name__ == "__main__":
    main()