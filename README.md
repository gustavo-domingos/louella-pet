# Louella Pet — landing page

HTML + CSS + JS puro, sem build. Publique o conteúdo desta pasta (`site/`) em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, Hostinger etc.).

## Rodar localmente

Abra `index.html` direto no navegador, ou sirva a pasta:

```bash
# Python
python -m http.server 8080
# ou Node
npx serve .
```

Depois acesse http://localhost:8080.

## Estrutura

```
index.html        página (todas as seções e produtos)
css/styles.css    estilos e tokens de cor/tipografia (no topo do arquivo)
js/main.js        menu mobile, filtro da vitrine, animações e a almofada interativa do hero
assets/           imagens WebP (480 e 800 px), logo, favicon e og-image.jpg
```

## Trocar uma imagem de produto

Substitua `assets/<nome>-480.webp` e `assets/<nome>-800.webp` (quadradas). Se usar JPG, ajuste o `src`/`srcset` no `index.html`.
