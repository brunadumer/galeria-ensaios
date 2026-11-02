<?php
declare(strict_types=1);

require __DIR__ . '/../lib/app.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function responder(array $d, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function falhar(string $msg, int $status = 400): void
{
    responder(['erro' => $msg], $status);
}

function texto(string $chave, int $max = 120): string
{
    $v = trim((string)($_POST[$chave] ?? ''));
    $v = preg_replace('/[\x00-\x1f\x7f]+/u', ' ', $v) ?? '';
    return mb_substr($v, 0, $max, 'UTF-8');
}

function dataPost(): string
{
    $d = trim((string)($_POST['data'] ?? ''));
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? $d : '';
}

/* ---------- Tentativas de senha ---------- */

function tentativas(): array
{
    $t = json_decode((string)@file_get_contents(DADOS . '/tentativas.json'), true);
    $agora = time();
    return array_filter(is_array($t) ? $t : [], fn($x) => $agora - ($x[1] ?? 0) < 900);
}

function chaveIp(): string
{
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
}

function bloqueado(): bool
{
    return (tentativas()[chaveIp()][0] ?? 0) >= 10;
}

function registrarFalha(): void
{
    $t = tentativas();
    $k = chaveIp();
    $t[$k] = [($t[$k][0] ?? 0) + 1, $t[$k][1] ?? time()];
    file_put_contents(DADOS . '/tentativas.json', json_encode($t), LOCK_EX);
    sleep(1);
}

function entrarNaSessao(): void
{
    session_regenerate_id(true);
    $_SESSION['ok'] = true;
}

/* ---------- Pedido ---------- */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') falhar('Método inválido.', 405);
if (empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    falhar('A foto é grande demais para o servidor.', 413);
}

$pastasOk = prepararPastas();
iniciarSessao();
$cfg = config();
$acao = (string)($_POST['acao'] ?? '');

if ($acao === 'estado') {
    responder([
        'configurado' => $cfg !== null,
        'logado' => $cfg !== null && logado(),
        'csrf' => csrf(),
        'estudio' => $cfg['estudio'] ?? '',
        'limite' => limiteEnvio(),
        'gravavel' => $pastasOk,
    ]);
}

if (!hash_equals(csrf(), (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) {
    falhar('Sua sessão expirou. Recarregue a página.', 403);
}
if (!$pastasOk) falhar('O servidor não deixou criar as pastas de dados. Verifique as permissões.', 500);

if ($acao === 'configurar') {
    if ($cfg !== null) falhar('A área já foi configurada. Entre com a senha.');
    $estudio = texto('estudio');
    $senha = (string)($_POST['senha'] ?? '');
    if ($estudio === '') falhar('Escreva seu nome ou o nome do estúdio.');
    if (mb_strlen($senha) < 8) falhar('A senha precisa ter pelo menos 8 caracteres.');
    gravarConfig(['estudio' => $estudio, 'senha' => password_hash($senha, PASSWORD_DEFAULT), 'criado' => date('c')]);
    entrarNaSessao();
    responder(['ok' => true]);
}

if ($acao === 'entrar') {
    if ($cfg === null) falhar('A área ainda não foi configurada.');
    if (bloqueado()) falhar('Muitas tentativas. Espere 15 minutos e tente de novo.', 429);
    if (!password_verify((string)($_POST['senha'] ?? ''), $cfg['senha'])) {
        registrarFalha();
        falhar('Senha incorreta.', 401);
    }
    entrarNaSessao();
    responder(['ok' => true]);
}

if ($acao === 'sair') {
    $_SESSION = [];
    session_destroy();
    responder(['ok' => true]);
}

/* Daqui em diante, só com a fotógrafa logada. */
if ($cfg === null || !logado()) falhar('Entre novamente para continuar.', 401);

$id = (string)($_POST['id'] ?? '');

switch ($acao) {
    case 'listar':
        $lista = array_map(function ($g) {
            $capa = null;
            foreach ($g['fotos'] as $f) if ($f['id'] === $g['capa']) $capa = urlFoto($g, $f, true);
            return [
                'id' => $g['id'], 'cliente' => $g['cliente'], 'titulo' => $g['titulo'], 'data' => $g['data'],
                'total' => count($g['fotos']), 'capa' => $capa,
            ];
        }, listarGalerias());
        responder(['galerias' => $lista]);

    case 'criar':
        $cliente = texto('cliente');
        if ($cliente === '') falhar('Escreva o nome da cliente.');
        do {
            $novo = (slugTexto($cliente) ?: 'galeria') . '-' . codigo(6);
        } while (is_file(META . "/$novo.json"));
        if (!@mkdir(GALERIAS . "/$novo", 0755)) falhar('Não foi possível criar a pasta da galeria.', 500);
        file_put_contents(GALERIAS . "/$novo/index.html", '');
        $g = [
            'id' => $novo, 'cliente' => $cliente, 'titulo' => texto('titulo'), 'data' => dataPost(),
            'capa' => null, 'criado' => date('c'), 'fotos' => [],
        ];
        gravarGaleria($g);
        responder(['galeria' => galeriaPublica($g)]);

    case 'obter':
        $g = lerGaleria($id);
        if (!$g) falhar('Galeria não encontrada.', 404);
        responder(['galeria' => galeriaPublica($g)]);

    case 'salvar':
        $cliente = texto('cliente');
        if ($cliente === '') falhar('O nome da cliente não pode ficar vazio.');
        $g = alterarGaleria($id, function ($g) use ($cliente) {
            $g['cliente'] = $cliente;
            $g['titulo'] = texto('titulo');
            $g['data'] = dataPost();
            if (isset($_POST['capa'])) {
                foreach ($g['fotos'] as $f) if ($f['id'] === $_POST['capa']) $g['capa'] = $f['id'];
            }
            return $g;
        });
        if (!$g) falhar('Galeria não encontrada.', 404);
        responder(['galeria' => galeriaPublica($g)]);

    case 'enviar':
        if (!lerGaleria($id)) falhar('Galeria não encontrada.', 404);
        $foto = $_FILES['foto'] ?? null;
        $mini = $_FILES['mini'] ?? null;
        if (!$foto || !$mini || $foto['error'] !== UPLOAD_ERR_OK || $mini['error'] !== UPLOAD_ERR_OK) {
            $erro = $foto['error'] ?? UPLOAD_ERR_NO_FILE;
            falhar(in_array($erro, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'A foto é grande demais para o servidor.' : 'A foto não chegou inteira. Tente de novo.');
        }
        $tipos = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
        $info = @getimagesize($foto['tmp_name']);
        if (!$info || !isset($tipos[$info[2]])) falhar('O arquivo não é uma foto JPG, PNG ou WEBP.');
        $infoMini = @getimagesize($mini['tmp_name']);
        if (!$infoMini || $infoMini[2] !== IMAGETYPE_JPEG) falhar('A miniatura chegou com defeito. Tente de novo.');

        // Largura e altura vêm do navegador, que já aplica a rotação da câmera.
        $w = (int)($_POST['w'] ?? 0);
        $h = (int)($_POST['h'] ?? 0);
        if ($w < 1 || $h < 1 || $w > 30000 || $h > 30000) [$w, $h] = [$info[0], $info[1]];

        $fid = bin2hex(random_bytes(8));
        $ext = $tipos[$info[2]];
        $pasta = GALERIAS . "/$id";
        if (!move_uploaded_file($foto['tmp_name'], "$pasta/$fid.$ext") || !move_uploaded_file($mini['tmp_name'], "$pasta/$fid-mini.jpg")) {
            @unlink("$pasta/$fid.$ext");
            falhar('Não foi possível gravar a foto no servidor.', 500);
        }
        $nova = [
            'id' => $fid, 'n' => basename(texto('nome')) ?: "foto.$ext", 'ext' => $ext,
            'w' => $w, 'h' => $h, 'bytes' => filesize("$pasta/$fid.$ext"),
        ];
        $g = alterarGaleria($id, function ($g) use ($nova) {
            $g['fotos'][] = $nova;
            usort($g['fotos'], fn($a, $b) => strnatcasecmp($a['n'], $b['n']));
            if (!$g['capa']) $g['capa'] = $nova['id'];
            return $g;
        });
        if (!$g) {
            @unlink("$pasta/$fid.$ext");
            @unlink("$pasta/$fid-mini.jpg");
            falhar('A galeria foi excluída durante o envio.', 404);
        }
        responder(['galeria' => galeriaPublica($g)]);

    case 'remover_foto':
        $fid = (string)($_POST['foto'] ?? '');
        $removida = null;
        $g = alterarGaleria($id, function ($g) use ($fid, &$removida) {
            foreach ($g['fotos'] as $i => $f) {
                if ($f['id'] === $fid) {
                    $removida = $f;
                    array_splice($g['fotos'], $i, 1);
                    break;
                }
            }
            if ($g['capa'] === $fid) $g['capa'] = $g['fotos'][0]['id'] ?? null;
            return $g;
        });
        if (!$g) falhar('Galeria não encontrada.', 404);
        if ($removida) {
            @unlink(GALERIAS . "/$id/{$removida['id']}.{$removida['ext']}");
            @unlink(GALERIAS . "/$id/{$removida['id']}-mini.jpg");
        }
        responder(['galeria' => galeriaPublica($g)]);

    case 'excluir':
        if (!lerGaleria($id)) falhar('Galeria não encontrada.', 404);
        @unlink(META . "/$id.json");
        @unlink(META . "/$id.lock");
        apagarPasta(GALERIAS . "/$id");
        responder(['ok' => true]);

    case 'ajustes':
        $estudio = texto('estudio');
        if ($estudio === '') falhar('Escreva seu nome ou o nome do estúdio.');
        $cfg['estudio'] = $estudio;
        $nova = (string)($_POST['senha_nova'] ?? '');
        if ($nova !== '') {
            if (!password_verify((string)($_POST['senha_atual'] ?? ''), $cfg['senha'])) falhar('A senha atual não confere.');
            if (mb_strlen($nova) < 8) falhar('A nova senha precisa ter pelo menos 8 caracteres.');
            $cfg['senha'] = password_hash($nova, PASSWORD_DEFAULT);
        }
        gravarConfig($cfg);
        responder(['ok' => true, 'estudio' => $estudio]);
}

falhar('Ação desconhecida.');
