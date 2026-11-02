<?php
declare(strict_types=1);

require __DIR__ . '/lib/app.php';

function enviarArquivo(string $arq, string $nome, string $tipo, bool $apagarDepois = false): void
{
    if (!is_file($arq)) {
        http_response_code(404);
        exit('Arquivo não encontrado.');
    }
    while (ob_get_level()) ob_end_clean();
    $ascii = preg_replace('/[^A-Za-z0-9._-]+/', '-', $nome);
    header('Content-Type: ' . $tipo);
    header('Content-Length: ' . filesize($arq));
    header("Content-Disposition: attachment; filename=\"$ascii\"; filename*=UTF-8''" . rawurlencode($nome));
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: private, max-age=3600');
    readfile($arq);
    if ($apagarDepois) @unlink($arq);
    exit;
}

$g = lerGaleria((string)($_GET['g'] ?? ''));
if (!$g) {
    http_response_code(404);
    exit('Galeria não encontrada.');
}
$pasta = GALERIAS . '/' . $g['id'];

if (isset($_GET['f'])) {
    foreach ($g['fotos'] as $i => $f) {
        if ($f['id'] === $_GET['f']) {
            enviarArquivo("$pasta/{$f['id']}.{$f['ext']}", nomeDownload($f, $i), EXTENSOES[$f['ext']]);
        }
    }
    http_response_code(404);
    exit('Foto não encontrada.');
}

if (!isset($_GET['todas']) || !$g['fotos']) {
    http_response_code(400);
    exit('Nada para baixar.');
}
if (!class_exists('ZipArchive')) {
    http_response_code(500);
    exit('O servidor não consegue gerar o arquivo .zip agora. Baixe as fotos uma a uma.');
}

@set_time_limit(600);
$tmp = tempnam(sys_get_temp_dir(), 'galeria');
$zip = new ZipArchive();
if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    http_response_code(500);
    exit('Não foi possível preparar o arquivo .zip.');
}
foreach ($g['fotos'] as $i => $f) {
    $arq = "$pasta/{$f['id']}.{$f['ext']}";
    if (!is_file($arq)) continue;
    $nome = sprintf('%03d-%s', $i + 1, nomeDownload($f, $i));
    $zip->addFile($arq, $nome);
    $zip->setCompressionName($nome, ZipArchive::CM_STORE);  // JPG já é comprimido
}
$zip->close();
enviarArquivo($tmp, 'fotos-' . (slugTexto($g['cliente']) ?: 'ensaio') . '.zip', 'application/zip', true);
