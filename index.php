<?php
declare(strict_types=1);

require __DIR__ . '/lib/app.php';

$base = baseUrl();
$cfg = config();
if ($cfg === null) {
    header('Location: ' . $base . '/admin/');
    exit;
}
header('X-Robots-Tag: noindex, nofollow');
$estudio = $cfg['estudio'];
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title><?= esc($estudio) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= esc($base) ?>/assets/estilo.css?v=<?= versao('assets/estilo.css') ?>">
</head>
<body>
<header class="hero sem-capa"><div class="hero-texto">
  <h1><?= esc($estudio) ?></h1>
  <p class="hero-sub">Recebeu o link do seu ensaio? Abra direto pela mensagem para ver suas fotos.</p>
</div></header>
<footer class="rodape"><p><a href="<?= esc($base) ?>/admin/">Área da fotógrafa</a></p></footer>
</body>
</html>
