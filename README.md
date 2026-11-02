# Galeria de ensaios

Sistema para a fotógrafa entregar as fotos de cada ensaio à cliente por um link.

- **Área da fotógrafa** (`/admin`): cria uma galeria por cliente, envia as fotos (do celular ou do computador), escolhe a capa e manda o link pelo WhatsApp.
- **Página da cliente** (`/nome-da-cliente-abc123`): capa com o nome dela, todas as fotos, download de cada uma e de todas em `.zip`. No celular, o botão **Salvar foto** manda a foto direto para a galeria do aparelho.

Os links levam um código aleatório e as páginas não aparecem no Google.

## Onde ficam as coisas

| Pasta | O que é | Vai para o GitHub? |
|---|---|---|
| `admin/`, `assets/`, `lib/`, `*.php` | Código | Sim |
| `dados/` | Senha (criptografada), sessões e dados das galerias | **Não**, criada no servidor |
| `galerias/` | Fotos das clientes | **Não**, criada no servidor |

As fotos só existem no servidor. Para backup, baixe as pastas `dados/` e `galerias/` pelo Gerenciador de Arquivos da Hostinger.

## Publicar na Hostinger

1. **Subdomínio**: hPanel → Domínios → Subdomínios → criar (ex.: `fotos.gddigital.com.br`). Anote a pasta que a Hostinger cria para ele.
2. **Git**: hPanel → Avançado → GIT → Criar novo repositório
   - Repositório: `https://github.com/brunadumer/galeria-ensaios.git`
   - Branch: `main`
   - Diretório: a pasta do subdomínio (precisa estar vazia; apague o `default.php` se houver).
   - Depois de criar, clique em **Implantar**. Para atualizar no futuro, clique em Implantar de novo (ou ative a implantação automática).
3. **SSL**: hPanel → Segurança → SSL → instalar para o subdomínio.
4. **Primeiro acesso**: abra `https://SEU-SUBDOMINIO/admin/` e crie o nome do estúdio e a senha. Faça isso logo após publicar: o primeiro acesso é quem define a senha.

Requisitos: PHP 8.1 ou mais novo, com `mbstring` e `zip` (padrão na Hostinger). O `.user.ini` aumenta o limite de envio para 64 MB por foto.

## Testar no computador

```bash
php -S 127.0.0.1:5520 -t galeria-ensaios
```

O servidor embutido do PHP não lê o `.htaccess`, então os links curtos das galerias só funcionam na Hostinger (ou com um roteador que imite as regras).
