let cols = 60, rows = 60;

let iso = new IsoDom({
    debug: false,
    target: document.getElementById('isodom'),
    columns: cols,
    rows: rows,
    cellSize: [190, 200],
    items: {
        rack: {
            orientation: IsoDom.ORIENTATION_SW,
            size: [1,1],
            images: {
                [IsoDom.ORIENTATION_NW]: { url: 'assets/tall_rack-1.png', offset: { top: -346, left: -1 } },
                [IsoDom.ORIENTATION_NE]: { url: 'assets/tall_rack-2.png', offset: { top: -36, left: -1} },
                [IsoDom.ORIENTATION_SE]: { url: 'assets/tall_rack-3.png', offset: { top: -36, left: -1} },
                [IsoDom.ORIENTATION_SW]: { url: 'assets/tall_rack-4.png', offset: { top: -39, left: 0 } },
            },
        }
    }
});

var loadAssets = () => {
    for (let y = 0; y < cols; y++) {
        for (let x = 0; x < rows; x++) {
            iso.addItem(new IsoDomItem('rack', iso, { orientation: IsoDom.ORIENTATION_NW }), x, y);
        }
    }
    iso.draw();
};

var createOverlays = () => {
    let container = document.getElementById('overlays');
    for (const el of document.getElementsByClassName('iso-dom-item')) {
        var overlay = document.createElement("div");
        overlay.setAttribute('id', 'overlay' + el.id);
        overlay.style.top = el.style.top;
        overlay.style.left = el.style.left;
        let image = document.createElement('img');
        image.src = 'assets/overlayimage.jpg';
        var text = document.createTextNode("O");
        overlay.appendChild(text);
        overlay.appendChild(image);
        container.appendChild(overlay);
    }
};

loadAssets();
createOverlays();