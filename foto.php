<?php
declare(strict_types=1);

require __DIR__ . '/lib/app.php';

$g = lerGaleria((string)($_GET['g'] ?? ''));
$fid = (string)($_GET['f'] ?? '');
$foto = null;
foreach ($g['fotos'] ?? [] as $f) if ($f['id'] === $fid) $foto = $f;
if (!$foto) {
    http_response_code(404);
    exit('Foto não encontrada.');
}

$mini = isset($_GET['mini']);
$arq = GALERIAS . '/' . $g['id'] . '/' . $foto['id'] . ($mini ? '-mini.jpg' : '.' . $foto['ext']);
if (!is_file($arq)) {
    http_response_code(404);
    exit('Foto não encontrada.');
}

// O id da foto é aleatório e nunca muda de conteúdo: pode ficar em cache para sempre.
$etag = '"' . $foto['id'] . ($mini ? 'm' : '') . '"';
header('Cache-Control: public, max-age=31536000, immutable');
header('ETag: ' . $etag);
header('X-Robots-Tag: noindex, nofollow');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
header('Content-Type: ' . ($mini ? 'image/jpeg' : EXTENSOES[$foto['ext']]));
header('Content-Length: ' . filesize($arq));
readfile($arq);
