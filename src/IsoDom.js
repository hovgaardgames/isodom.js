class IsoDomCell {
    /**
     * Create new instance of IsoDomCell.
     * @param {IsoDom} isoDom
     * @param {HTMLElement} el
     * @param {Number} x
     * @param {Number} y
     */
    constructor(isoDom, el, x, y) {
        this.iso = isoDom;
        this.el = el;
        this.x = x;
        this.y = y;
        this.z = null;
        /** @type {IsoDomCell} */
        this.itemRootCell = null;
        /** @type {IsoDomItem} */
        this.item = null;

        this.update();
    }

    /**
     * Redraw cell.
     */
    update() {
        if (this.iso.isDebugging()) {
            this.el.innerHTML = `X: ${this.x}<br/>Y: ${this.y}<br/>Z: ${this.z || '-'}`;

            if (this.item) {
                this.el.style.backgroundColor = this.isItemRoot() ? '#888888' : '#c3c3c3';
            } else {
                this.el.style.backgroundColor = '';
            }
        } else {
            this.el.innerHTML = '';
            this.el.style.backgroundColor = '';
        }

        if (this.item && this.isItemRoot()) {
            this.item.positionOnCell(this);

            if (this.z === null) {
                this.item.el.style.zIndex = '';
            } else {
                this.item.el.style.zIndex = this.z;
            }
        }
    }

    /**
     * Get cell position.
     * @return {{top, left}}
     */
    position() {
        return this.iso.config.cellPosition(this);
    }

    /**
     * Determine if the cell contains item root.
     * @returns {Boolean}
     */
    isItemRoot() {
        return this.itemRootCell === this;
    }

    /**
     * Set cell item.
     * @param {IsoDomItem} item
     * @param {IsoDomCell} root
     */
    setItem(item, root) {
        this.item = item;
        this.itemRootCell = root;
    }

    /**
     * Get root cell.
     * @returns {IsoDomCell}
     */
    getRootCell() {
        return this.itemRootCell;
    }
}

class IsoDomItem {
    /**
     * Create new instance of IsoDomItem.
     * @param {String} name
     * @param {IsoDom} isoDom
     * @param {*} config
     */
    constructor(name, isoDom, config = {}) {
        this.defaults = isoDom.getItemConfig(name);
        if (!this.defaults) {
            throw new Error(`IsoDom does not contain "${name}" item configuration.`);
        }

        this.name = name;
        this.iso = isoDom;
        /** @type {HTMLElement} */
        this.el = null;
        this.orientation = config.orientation || this.defaults.orientation;
        this.images = config.images || this.defaults.images;
    }

    /**
     * Set element.
     * @param {HTMLElement} el
     */
    setElement(el) {
        this.el = el;
        this.update();
    }

    /**
     * Get image source.
     * @returns {*|HTMLImageElement}
     */
    image() {
        return this.images[this.orientation];
    }

    /**
     * Update IsoDomItem.
     */
    update() {
        if (this.el) {
            this.el.setAttribute('src', this.image());
            this.el.setAttribute('data-name', this.name);
            this.el.setAttribute('data-orientation', this.orientation);
        }
    }

    /**
     * Get item width.
     * @returns {Number}
     */
    getWidth() {
        const horizontal = [IsoDom.ORIENTATION_SW, IsoDom.ORIENTATION_NE].includes(this.orientation);
        return this.defaults.size[horizontal ? 0 : 1];
    }

    /**
     * Get item height.
     * @returns {Number}
     */
    getHeight() {
        const horizontal = [IsoDom.ORIENTATION_SW, IsoDom.ORIENTATION_NE].includes(this.orientation);
        return this.defaults.size[horizontal ? 1 : 0];
    }

    /**
     * Rotate image.
     * @param {Boolean} clockwise
     */
    rotate(clockwise = true) {
        const order = [IsoDom.ORIENTATION_SW, IsoDom.ORIENTATION_NW, IsoDom.ORIENTATION_NE, IsoDom.ORIENTATION_SE];
        const current = order.indexOf(this.orientation);
        let next = clockwise ? current + 1 : current - 1;

        if (next < 0) {
            next = order.length - 1;
        } else if (next >= order.length) {
            next = 0;
        }

        this.orientation = order[next];
        this.update();
    }

    /**
     * Position the item on cell.
     * @param {IsoDomCell} cell
     */
    positionOnCell(cell) {
        const position = cell.position();
        this.el.style.top = `${position.top}px`;
        this.el.style.left = `${position.left}px`;
    }
}

class IsoDom {
    /**
     * Create new instance of IsoDom.
     */
    constructor(config = {}) {
        this.cells = {};
        this.config = {
            debug: false,
            /** @type HTMLElement */
            table: null,
            /** @type HTMLElement */
            itemContainer: null,
            items: {},
            cellSize: [100, 100],
            rows: 10,
            columns: 10,
            gridClass: 'iso-dom',
            rowClass: 'iso-dom__row',
            columnClass: 'iso-dom__column',
            itemContainerClass: 'iso-dom-items',
            cellCreated(node, cell, iso) {
                // Do nothing
            },
            cellPosition(cell) {
                // TODO using jQuery
                return $(cell.el).position();
            },
        };

        Object.assign(this.config, config);

        // Validate table
        if (!this.config.table || this.config.table.nodeName !== 'TABLE') {
            throw new Error('`table` config property must be set and must be table element.');
        }

        // Validate item container
        if (!this.config.itemContainer || !this.config.itemContainer.nodeName) {
            throw new Error('`itemContainer` config property must be set and must be an element.');
        }

        // Set grid size and add classes
        this.config.table.style.width = (this.config.columns * this.config.cellSize[0]) + 'px';
        this.config.table.style.height = (this.config.rows * this.config.cellSize[1]) + 'px';
        this.config.table.classList.add(this.config.gridClass);
        this.config.itemContainer.classList.add(this.config.itemContainerClass);

        if (this.config.debug) {
            this.config.table.classList.add('iso-dom--debug');
        }

        this._createGrid();
    }

    /**
     * Get item default config.
     * @param {String} name
     * @returns {*}
     */
    getItemConfig(name) {
        return this.config.items[name];
    }

    /**
     * Place item on grid.
     * @param {IsoDomItem} item
     * @param {Number} x
     * @param {Number} y
     */
    placeItem(item, x, y) {
        this._mountItem(item);
        this._mapItemToCells(item, this.cell(x, y));
    }

    /**
     * Get state if currently debugging.
     * @return {Boolean}
     */
    isDebugging() {
        return this.config.debug;
    }

    /**
     * Get a cell at position.
     * @param {Number} x
     * @param {Number} y
     * @return {IsoDomCell|undefined}
     */
    cell(x, y) {
        return this.cells[IsoDom.cellID(x, y)];
    }

    /**
     * Execute DOM draw (aka. calculate z-index =.=).
     */
    draw() {
        Object.values(this.cells).forEach(cell => {
            cell.z = null;
        });

        // Collect all cells and keep only root item cells
        const boxes = this._cellBox(0, 0, this.config.columns, this.config.rows)
            .filter(box => box.cell.item && box.cell.isItemRoot());

        // Set cell index
        const setIndex = box => {
            const limiters = [];

            const zone = this._cellBox(0, 0, box.cell.x + box.cell.item.getWidth(), box.cell.y + box.cell.item.getHeight());
            zone.forEach(zoneBox => {
                if (zoneBox.cell.item && zoneBox.cell.isItemRoot() && zoneBox.cell.item !== box.cell.item && zoneBox.cell.z) {
                    limiters.push(zoneBox.cell.z);
                }
            });

            box.cell.z = limiters.length ? Math.max(...limiters) + 1 : box.y + 1 + box.x;
        };

        // Calculate z-index only for single row objects - might seem like this
        // does nothing, but it is required for objects like glass window (1x1) behind a closet (1x2).
        boxes.filter(box => box.cell.item.getHeight() === 1).forEach(setIndex);
        // Glue shit together
        boxes.forEach(setIndex);
        // Make sure items are still in correct position because of mixed calculation order.
        // e.g. glass-wall (1x1) bottom does not get on top of bench-red (1x2).
        boxes.filter(box => box.cell.item.getHeight() > 1).forEach(setIndex);
        // Final pass to make sure bench-red and such does not cut through the middle of a glass wall.
        boxes.forEach(setIndex);

        Object.keys(this.cells).forEach(cell => {
            this.cells[cell].update();
        });
    }

    /**
     * Find IsoDomItem root cell.
     * @param {IsoDomItem} item
     * @returns {IsoDomCell[]|null}
     * @private
     */
    findItemCells(item) {
        return Object.values(this.cells).filter(cell => cell.item === item);
    }

    /**
     * Create IsoDom grid.
     * @private
     */
    _createGrid() {
        let bodyNode = document.createElement('tbody');

        for (let row = 0; row < this.config.rows; row++) {
            let rowNode = document.createElement('tr');
            rowNode.classList.add(this.config.rowClass);

            for (let col = 0; col < this.config.columns; col++) {
                let columnNode = document.createElement('td');
                columnNode.classList.add(this.config.columnClass);
                columnNode.__isodomcell__ = new IsoDomCell(this, columnNode, col, row);
                this._mapCell(columnNode.__isodomcell__);

                // Call on cell created user callback
                this.config.cellCreated(columnNode, columnNode.__isodomcell__, this);

                rowNode.appendChild(columnNode);
            }
            bodyNode.appendChild(rowNode);
        }

        this.config.table.appendChild(bodyNode);
    }

    /**
     * Mount item into DOM.
     * @param {IsoDomItem} item
     * @private
     * @returns {IsoDomItem}
     */
    _mountItem(item) {
        if (item.el) {
            return item;
        }

        const img = document.createElement('img');
        this.config.itemContainer.appendChild(img);

        item.setElement(img);

        return item;
    }

    /**
     * Map IsoDomCell.
     * @param {IsoDomCell} cell
     * @private
     */
    _mapCell(cell) {
        this.cells[IsoDom.cellID(cell.x, cell.y)] = cell;
    }

    /**
     * Map item to cells.
     * @param {IsoDomItem} item
     * @param {IsoDomCell} rootCell
     * @private
     */
    _mapItemToCells(item, rootCell) {
        for (let x = rootCell.x; x < rootCell.x + item.getWidth(); x++) {
            for (let y = rootCell.y; y < rootCell.y + item.getHeight(); y++) {
                const cell = this.cell(x, y);

                // TODO intersects with another item

                cell.setItem(item, rootCell);
            }
        }
    }

    /**
     * Unmap item from it's cells.
     * @param {IsoDomItem} item
     * @private
     */
    _unmapItemFromCells(item) {
        const cells = this.findItemCells(item);

        if (!cells.length) {
            console.warn(`Item "${item.name}" is not in the DOM.`);
            return;
        }

        cells.forEach(cell => cell.setItem(null, null));
    }

    /**
     * Array of cell boxes.
     * @param {Number} startX
     * @param {Number} startY
     * @param {Number} endX
     * @param {Number} endY
     * @returns {Array}
     * @private
     */
    _cellBox(startX, startY, endX, endY) {
        const box = [];

        for (let row = startY; row < endY; row++) {
            for (let col = startX; col < endX; col++) {
                box.push({ x: col, y: row, cell: this.cell(col, row) });
            }
        }

        return box;
    }

    /**
     * Get cell ID.
     * @param {Number} x
     * @param {Number} y
     * @return {String}
     */
    static cellID(x, y) {
        return `${x}-${y}`;
    }
}

// No support of static props in class ಠ益ಠ)
IsoDom.ORIENTATION_SW = 'SW'; // ↙
IsoDom.ORIENTATION_NE = 'NE'; // ↗
IsoDom.ORIENTATION_SE = 'SE'; // ↘
IsoDom.ORIENTATION_NW = 'NW'; // ↖
