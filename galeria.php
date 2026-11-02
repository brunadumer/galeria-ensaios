<?php
declare(strict_types=1);

require __DIR__ . '/lib/app.php';

header('X-Robots-Tag: noindex, nofollow');
$base = baseUrl();
$cfg = config() ?? [];
$estudio = $cfg['estudio'] ?? '';
$g = lerGaleria((string)($_GET['id'] ?? ''));

if (!$g) {
    http_response_code(404);
    $titulo = 'Galeria não encontrada';
} else {
    $pub = galeriaPublica($g);
    $titulo = 'Ensaio de ' . $g['cliente'];
    $descricao = implode(' · ', array_filter([$g['titulo'], dataBonita($g['data']), $estudio ? "Fotos por $estudio" : '']));
    $capa = null;
    foreach ($pub['fotos'] as $f) if ($f['id'] === $g['capa']) $capa = $f['mini'];
    $estado = $pub + ['estudio' => $estudio];
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title><?= esc($titulo) ?></title>
<?php if ($g): ?>
<meta property="og:type" content="website">
<meta property="og:title" content="<?= esc($titulo) ?>">
<?php if ($descricao): ?><meta property="og:description" content="<?= esc($descricao) ?>"><?php endif ?>
<?php if ($capa): ?><meta property="og:image" content="<?= esc(urlAbsoluta(substr($capa, strlen($base)))) ?>"><?php endif ?>
<?php endif ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= esc($base) ?>/assets/estilo.css?v=<?= versao('assets/estilo.css') ?>">
</head>
<body>
<?php if (!$g): ?>
<header class="hero sem-capa"><div class="hero-texto">
  <h1>Galeria não encontrada</h1>
  <p class="hero-sub">Confira se o link está completo, ou peça um novo link<?= $estudio ? ' a ' . esc($estudio) : '' ?>.</p>
</div></header>
<?php else: ?>
<div id="root"></div>
<script type="application/json" id="estado"><?= json_encode($estado, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<script src="<?= esc($base) ?>/assets/galeria.js?v=<?= versao('assets/galeria.js') ?>"></script>
<?php endif ?>
</body>
</html>
