# Galeria de ensaios

Sistema para a fotógrafa entregar as fotos de cada ensaio à cliente por um link.

- **Área da fotógrafa** (`/admin`): cria uma galeria por cliente, envia as fotos (do celular ou do computador), escolhe a capa e manda o link pelo WhatsApp.
- **Página da cliente** (`/nome-da-cliente-abc123`): capa com o nome dela, todas as fotos, download de cada uma e de todas em `.zip`. No celular, o botão **Salvar foto** manda a foto direto para a galeria do aparelho.

Os links levam um código aleatório e as páginas não aparecem no Google.

## Onde ficam as coisas

| Pasta | O que é | Vai para o GitHub? |
|---|---|---|
| `admin/`, `assets/`, `lib/`, `*.php` | Código | Sim |
| `../galeria-dados/` | Senha (criptografada), sessões, dados das galerias e fotos das clientes | **Não**, criada no servidor |

A pasta `galeria-dados` fica **ao lado** do `public_html`, não dentro dele. Assim uma nova implantação do GitHub nunca apaga as fotos, e nenhuma foto é servida direto: tudo passa pelo `foto.php` e pelo `baixar.php`. Se o servidor não deixar criar essa pasta, o sistema usa `dados/` dentro do site.

Para backup, baixe a pasta `galeria-dados` pelo Gerenciador de Arquivos da Hostinger.

## Publicar na Hostinger

1. **Site**: hPanel → Sites → Criar site → Site PHP/HTML → `galeria.gddigital.com.br`. Ele é um site separado (e não um subdomínio dentro do `public_html` da GD Digital), para que os deploys de um não mexam no outro.
2. **Git**: no painel do site → Avançado → GIT → Continuar com GitHub → repositório `brunadumer/galeria-ensaios`, branch `main`, implantação automática.
3. **DNS**: o domínio gddigital.com.br não usa os nameservers da Hostinger. No provedor de DNS, crie um registro `A` para `galeria` apontando para o IP do site (hPanel → painel do site → Plano de hospedagem / Detalhes).
4. **SSL**: hPanel → Segurança → SSL → instalar para `galeria.gddigital.com.br` (depois que o DNS propagar).
5. **Primeiro acesso**: abra `https://SEU-SUBDOMINIO/admin/` e crie o nome do estúdio e a senha. Faça isso logo após publicar: o primeiro acesso é quem define a senha.

Requisitos: PHP 8.1 ou mais novo, com `mbstring` e `zip` (padrão na Hostinger). O `.user.ini` aumenta o limite de envio para 64 MB por foto.

## Testar no computador

```bash
php -S 127.0.0.1:5520 -t galeria-ensaios
```

O servidor embutido do PHP não lê o `.htaccess`, então os links curtos das galerias só funcionam na Hostinger (ou com um roteador que imite as regras).
