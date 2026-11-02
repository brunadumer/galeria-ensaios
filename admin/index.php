<?php
declare(strict_types=1);

require __DIR__ . '/../lib/app.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
$base = baseUrl();
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title>Minhas galerias</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= esc($base) ?>/assets/estilo.css?v=<?= versao('assets/estilo.css') ?>">
</head>
<body data-base="<?= esc($base) ?>">
<div id="root"><p class="carregando">Carregando…</p></div>
<script src="<?= esc($base) ?>/assets/admin.js?v=<?= versao('assets/admin.js') ?>"></script>
</body>
</html>
