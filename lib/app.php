<?php
declare(strict_types=1);

define('RAIZ', dirname(__DIR__));
define('DADOS', armazem());                  // config, sessões, galerias e fotos (nunca servido direto)
define('META', DADOS . '/galerias');
define('GALERIAS', DADOS . '/fotos');        // fotos saem pelo foto.php e pelo baixar.php

/**
 * Pasta dos dados. Fica ao lado da pasta do site (fora do public_html), para que
 * uma nova implantação do GitHub nunca apague as fotos das clientes.
 */
function armazem(): string
{
    $fora = dirname(RAIZ) . '/galeria-dados';
    if ((is_dir($fora) || @mkdir($fora, 0755, true)) && is_writable($fora)) return $fora;
    return RAIZ . '/dados';
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const EXTENSOES = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];

function prepararPastas(): bool
{
    foreach ([DADOS, META, DADOS . '/sessoes', GALERIAS] as $p) {
        if (!is_dir($p)) @mkdir($p, 0755, true);
    }
    // Proteção para quando a pasta de dados acaba dentro do site.
    $protecoes = [
        DADOS . '/.htaccess' => "Require all denied\n",
        DADOS . '/index.html' => '',
    ];
    foreach ($protecoes as $arq => $conteudo) {
        if (!is_file($arq)) @file_put_contents($arq, $conteudo);
    }
    return is_writable(META) && is_writable(GALERIAS);
}

/* ---------- Configuração ---------- */

function config(): ?array
{
    $arq = DADOS . '/config.php';
    if (!is_file($arq)) return null;
    $c = include $arq;
    return is_array($c) ? $c : null;
}

function gravarConfig(array $c): void
{
    $arq = DADOS . '/config.php';
    $tmp = $arq . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, "<?php\nreturn " . var_export($c, true) . ";\n", LOCK_EX);
    rename($tmp, $arq);
    if (function_exists('opcache_invalidate')) @opcache_invalidate($arq, true);
}

/* ---------- Texto ---------- */

function esc(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function slugTexto(string $s): string
{
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = strtr($s, [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', 'ñ' => 'n',
    ]);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
    return trim(substr($s, 0, 40), '-');
}

function codigo(int $n): string
{
    $alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
    $s = '';
    for ($i = 0; $i < $n; $i++) $s .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
    return $s;
}

function dataBonita(string $iso): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $iso, $m)) return '';
    return (int)$m[3] . ' de ' . MESES[(int)$m[2] - 1] . ' de ' . $m[1];
}

function idValido(string $id): bool
{
    return (bool)preg_match('/^[a-z0-9-]{3,80}$/', $id);
}

/* ---------- Galerias ---------- */

function lerGaleria(string $id): ?array
{
    if (!idValido($id)) return null;
    $arq = META . "/$id.json";
    if (!is_file($arq)) return null;
    $g = json_decode((string)file_get_contents($arq), true);
    return is_array($g) ? $g : null;
}

function gravarGaleria(array $g): void
{
    $arq = META . '/' . $g['id'] . '.json';
    $tmp = $arq . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, json_encode($g, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    rename($tmp, $arq);
}

/** Lê, altera e grava a galeria com trava, para envios em paralelo não se atropelarem. */
function alterarGaleria(string $id, callable $fn): ?array
{
    if (!idValido($id)) return null;
    $trava = fopen(META . "/$id.lock", 'c');
    flock($trava, LOCK_EX);
    try {
        $g = lerGaleria($id);
        if ($g === null) return null;
        $g = $fn($g);
        gravarGaleria($g);
        return $g;
    } finally {
        flock($trava, LOCK_UN);
        fclose($trava);
    }
}

function listarGalerias(): array
{
    $lista = [];
    foreach (glob(META . '/*.json') ?: [] as $arq) {
        $g = json_decode((string)file_get_contents($arq), true);
        if (is_array($g) && isset($g['id'])) $lista[] = $g;
    }
    usort($lista, fn($a, $b) => strcmp($b['criado'] ?? '', $a['criado'] ?? ''));
    return $lista;
}

function urlFoto(array $g, array $f, bool $mini = false): string
{
    return baseUrl() . '/foto.php?g=' . $g['id'] . '&f=' . $f['id'] . ($mini ? '&mini=1' : '');
}

function nomeDownload(array $f, int $i): string
{
    $base = preg_replace('/\.[^.]+$/', '', (string)($f['n'] ?? '')) ?? '';
    $base = trim(preg_replace('/[\\\\\/:*?"<>|\x00-\x1f]+/', '-', $base) ?? '');
    if ($base === '') $base = 'foto-' . ($i + 1);
    return $base . '.' . $f['ext'];
}

/** Galeria no formato que as páginas usam, já com os endereços das fotos. */
function galeriaPublica(array $g): array
{
    $base = baseUrl();
    $fotos = [];
    foreach ($g['fotos'] as $i => $f) {
        $fotos[] = [
            'id' => $f['id'], 'w' => $f['w'], 'h' => $f['h'],
            'src' => urlFoto($g, $f), 'mini' => urlFoto($g, $f, true),
            'arquivo' => nomeDownload($f, $i),
            'baixar' => $base . '/baixar.php?g=' . $g['id'] . '&f=' . $f['id'],
        ];
    }
    return [
        'id' => $g['id'], 'cliente' => $g['cliente'], 'titulo' => $g['titulo'], 'data' => $g['data'],
        'capa' => $g['capa'], 'criado' => $g['criado'], 'fotos' => $fotos,
        'link' => urlAbsoluta('/' . $g['id']),
        'zip' => $base . '/baixar.php?g=' . $g['id'] . '&todas=1',
    ];
}

function apagarPasta(string $p): void
{
    if (!is_dir($p)) return;
    foreach (scandir($p) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $c = "$p/$item";
        is_dir($c) ? apagarPasta($c) : @unlink($c);
    }
    @rmdir($p);
}

/* ---------- Endereços ---------- */

function https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

/** Caminho da raiz do app no site ('' quando está na raiz do subdomínio). */
function baseUrl(): string
{
    $dir = dirname(str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/'));
    if (basename($dir) === 'admin') $dir = dirname($dir);
    return rtrim(str_replace('\\', '/', $dir), '/');
}

function urlAbsoluta(string $caminho): string
{
    return (https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . baseUrl() . $caminho;
}

/* ---------- Sessão da fotógrafa ---------- */

function iniciarSessao(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $duracao = 60 * 60 * 24 * 30;
    ini_set('session.gc_maxlifetime', (string)$duracao);
    ini_set('session.use_strict_mode', '1');
    session_save_path(DADOS . '/sessoes');
    session_name('galeria_adm');
    session_set_cookie_params([
        'lifetime' => $duracao, 'path' => baseUrl() . '/admin/',
        'secure' => https(), 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

function logado(): bool
{
    iniciarSessao();
    return !empty($_SESSION['ok']);
}

function csrf(): string
{
    iniciarSessao();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

/* ---------- Limites de envio ---------- */

function bytesIni(string $chave): int
{
    $v = trim((string)ini_get($chave));
    if ($v === '') return 0;
    $n = (float)$v;
    $u = strtolower(substr($v, -1));
    if ($u === 'g') $n *= 1024 ** 3;
    elseif ($u === 'm') $n *= 1024 ** 2;
    elseif ($u === 'k') $n *= 1024;
    return (int)$n;
}

/** Tamanho máximo da foto original num envio (a miniatura vai junto). */
function limiteEnvio(): int
{
    $arquivo = bytesIni('upload_max_filesize') ?: 2 * 1024 * 1024;
    $post = bytesIni('post_max_size') ?: PHP_INT_MAX;
    return max(1024 * 1024, min($arquivo, $post - 3 * 1024 * 1024, 30 * 1024 * 1024));
}

function versao(string $arquivo): string
{
    return (string)(@filemtime(RAIZ . '/' . $arquivo) ?: 1);
}
