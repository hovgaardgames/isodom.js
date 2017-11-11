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
        this._cachePosition = null;

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
        if (this._cachePosition === null) {
            this._cachePosition = this.iso.config.cellPosition(this);
        }

        return this._cachePosition;
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
        this.z = null;
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
        // Determine if IsoDom contains item configuration.
        this.defaults = isoDom.getItemConfig(name);
        if (!this.defaults) {
            throw new Error(`IsoDom does not contain "${name}" item configuration.`);
        }

        this.name = name;
        this.iso = isoDom;
        /** @type {HTMLElement} */
        this.el = null;

        Object.assign(this, config);

        // Current item orientation
        if (!this.orientation) {
            this.orientation = config.orientation || this.defaults.orientation;
        }
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
     * Get item cells.
     * @returns {IsoDomCell[]}
     */
    cells() {
        return this.iso.findItemCells(this);
    }

    /**
     * Get item root cell.
     * @returns {IsoDomCell|undefined}
     */
    rootCell() {
        return this.iso.findItemCells(this).find(cell => cell.isItemRoot());
    }

    /**
     * Get image source.
     * @returns {*|HTMLImageElement}
     */
    image() {
        return this.defaults.images[this.orientation];
    }

    /**
     * Update IsoDomItem.
     */
    update() {
        if (this.el) {
            if (typeof this.defaults.update === 'function') {
                this.defaults.update(this);
            } else {
                this.iso.config.updateItem(this);
            }

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

        this.iso.emit('itemRotated', this);
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

    /**
     * Remove item from grid.
     */
    remove() {
        this.iso.removeItem(this);
    }

    /**
     * Place item into the grid on specified position.
     * If item already exists it will be moved, otherwise it will be added.
     * @param {Number} x
     * @param {Number} y
     */
    place(x, y) {
        this.iso.moveItem(this, x, y);
    }

    /**
     * Mount item to DOM.
     */
    mount() {
        this.iso.mountItem(this);
    }

    /**
     * Remove item from DOM.
     */
    unmount() {
        this.iso.unmountItem(this);
    }
}

class IsoDom {
    /**
     * Create new instance of IsoDom.
     */
    constructor(config = {}) {
        this._listeners = {};
        this.cells = {};
        this.grid = null;
        this.itemContainer = null;
        this.config = {
            debug: false,
            /** @type HTMLElement */
            target: null,
            scrollContainer: null,
            items: {},
            cellSize: [100, 100],
            rows: 10,
            columns: 10,
            gridClass: 'iso-dom',
            itemClass: 'iso-dom-item',
            columnClass: 'iso-dom__column',
            itemContainerClass: 'iso-dom-items',
            plugins: [],
            events: {},
            cellPosition(cell) {
                const rect = cell.el.getBoundingClientRect();

                let top = 0;
                let left = 0;

                if (this.scrollContainer === document.body) {
                    const body = document.body;
                    const doc = document.documentElement;

                    const scrollTop = (window.pageYOffset || doc.scrollTop || body.scrollTop) / (document.body.style.zoom || 1);
                    const scrollLeft = (window.pageXOffset || doc.scrollLeft || body.scrollLeft) / (document.body.style.zoom || 1);

                    top = rect.top + scrollTop;
                    left = rect.left + scrollLeft;
                } else {
                    top = rect.top + this.scrollContainer.scrollTop;
                    left = rect.left + this.scrollContainer.scrollLeft;
                }

                return {
                    top: Math.round(top),
                    left: Math.round(left),
                };
            },
            createItem(item) {
                return document.createElement('img');
            },
            updateItem(item) {
                let image = item.image();
                item.el.setAttribute('src', image.url);
                item.el.style.marginTop = image.offset.top + "px";
                item.el.style.marginLeft = image.offset.left + "px";
            },
        };

        Object.assign(this.config, config);

        // Set scroll container
        if (!this.config.scrollContainer) {
            this.config.scrollContainer = this.config.target;
        }

        // Register events
        for (let eventName in this.config.events) {
            this.on(eventName, this.config.events[eventName]);
        }

        // Install plugins
        this.config.plugins.forEach(plugin => {
            plugin.install(this);
        });

        // Validate grid element
        if (!this.config.target || !this.config.target.nodeName) {
            throw new Error('`target` config property must be set and must be an HTMLElement.');
        }

        this._init();

        this.on(['itemAdded', 'itemRemoved', 'itemMoved'], () => {
            this.emit('itemsChanged', this);
        });
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
    addItem(item, x, y) {
        this.assertItemPlacement(item, x, y, false);
        const cell = this.cell(x, y);

        this.mountItem(item);
        this._mapItemToCells(item, cell);

        this.emit('itemAdded', item, cell, this);
    }

    /**
     * Remove item from grid.
     * @param {IsoDomItem} item
     */
    removeItem(item) {
        this._unmapItemFromCells(item);
        this.unmountItem(item);
        item.setElement(null);

        this.emit('itemRemoved', item, this);
    }

    /**
     * Move item to another place.
     * @param {IsoDomItem} item
     * @param {Number} x
     * @param {Number} y
     */
    moveItem(item, x, y) {
        if (!item.rootCell()) {
            this.addItem(item, x, y);
            return;
        }

        this.assertItemPlacement(item, x, y, true);
        const fromCell = item.rootCell();
        const cell = this.cell(x, y);

        iso._unmapItemFromCells(item);
        iso._mapItemToCells(item, cell);

        this.emit('itemMoved', item, cell, fromCell, this);
    }

    /**
     * Create new IsoDomItem.
     * @param {String} name
     * @param {*} config
     * @returns {IsoDomItem}
     */
    makeItem(name, config = {}) {
        return new IsoDomItem(name, this, config);
    }

    /**
     * Assert item placement on cell:
     * - the cell is valid;
     * - the item would not go out of bounds;
     * - the area for the item is not taken by another item.
     * @param {IsoDomItem} item
     * @param {Number} x
     * @param {Number} y
     * @param {Boolean} ignoringItem
     */
    assertItemPlacement(item, x, y, ignoringItem) {
        const cell = this.cell(x, y);

        if (!cell) {
            throw new Error(`Cell (${x}, ${y}) is invalid.`);
        }

        if (this.isOutOfBounds(item, x, y)) {
            throw new Error(`Item cannot be placed at (${x}, ${y}) as it would go out of bounds.`);
        }

        if (this.isAreaTaken(x, y, x + item.getWidth(), y + item.getHeight(), ignoringItem ? item : null)) {
            throw new Error(`Area in range {(${x}, ${y}), (${x + item.getWidth() - 1}, ${y + item.getHeight() - 1})} is taken by another item.`);
        }
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
     * Execute DOM update (aka. calculate z-indexes).
     * @param {Number} col Beginning column.
     * @param {Number} row Beginning row.
     */
    draw(col = 0, row = 0) {
        const partial = col + row > 0;

        // Calculate segment
        for (let y = row; y < this.config.rows; y++) {
            for (let x = col; x < this.config.columns; x++) {
                const cell = this.cell(x, y);

                if (!cell.item) {
                    continue;
                }

                if (cell.isItemRoot()) {
                    this._renderPath(x, y);
                } else if (partial && x === col && y > row) {
                    // Necessary only for partial render only
                    const root = cell.getRootCell();
                    this._renderPath(root.x, root.y);
                }
            }
        }

        // Update cells
        for (const cell in this.cells) {
            this.cells[cell].update();
        }
    }

    /**
     * Find IsoDomItem root cell.
     * @param {IsoDomItem} item
     * @returns {IsoDomCell[]|null}
     */
    findItemCells(item) {
        const cells = [];

        for (const cell in this.cells) {
            if (this.cells[cell].item === item) {
                cells.push(this.cells[cell]);
            }
        }

        return cells;
    }

    /**
     * Determine if area is taken.
     * @param {Number} startX
     * @param {Number} startY
     * @param {Number} endX
     * @param {Number} endY
     * @param {IsoDomItem} ignoreItem
     * @returns {Boolean}
     */
    isAreaTaken(startX, startY, endX, endY, ignoreItem = null) {
        return this.takenCells(startX, startY, endX, endY, ignoreItem).length > 0;
    }

    /**
     * Determine if area is available for new items.
     * @param {Number} startX
     * @param {Number} startY
     * @param {Number} endX
     * @param {Number} endY
     * @param {IsoDomItem} ignoreItem
     * @returns {Boolean}
     */
    isAreaAvailable(startX, startY, endX, endY, ignoreItem = null) {
        return this.takenCells(startX, startY, endX, endY, ignoreItem).length === 0;
    }

    /**
     * Get all taken cells in area.
     * @param {Number} startX
     * @param {Number} startY
     * @param {Number} endX
     * @param {Number} endY
     * @param {IsoDomItem} ignoreItem
     * @returns {Boolean}
     * @returns {Array}
     */
    takenCells(startX, startY, endX, endY, ignoreItem = null) {
        const cells = [];

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const cell = this.cell(x, y);
                if (cell.item && cell.item !== ignoreItem) {
                    cells.push(cell);
                }
            }
        }

        return cells;
    }

    /**
     * Determine if an item would go out of bounds when placed on position.
     * @param {IsoDomItem} item
     * @param {Number} x
     * @param {Number} y
     * @returns {Boolean}
     */
    isOutOfBounds(item, x, y) {
        return !Boolean(this.cell(x + item.getWidth() - 1, y + item.getHeight() - 1));
    }

    /**
     * Mount item into DOM.
     * @param {IsoDomItem} item
     * @returns {IsoDomItem}
     */
    mountItem(item) {
        if (item.el) {
            return item;
        }

        const node = item.defaults.create ? item.defaults.create(item) : this.config.createItem(item);
        node.classList.add(this.config.itemClass);
        this.itemContainer.appendChild(node);
        item.setElement(node);

        return item;
    }

    /**
     * Remove item from DOM.
     * @param {IsoDomItem} item
     */
    unmountItem(item) {
        if (!item.el) {
            return;
        }

        item.el.parentNode.removeChild(item.el);
    }

    /**
     * Array of cell boxes.
     * @param {Number} startX
     * @param {Number} startY
     * @param {Number} endX
     * @param {Number} endY
     * @returns {Array}
     */
    itemsInArea(startX = 0, startY = 0, endX = this.config.columns, endY = this.config.rows) {
        const box = [];

        for (let row = startY; row < endY; row++) {
            for (let col = startX; col < endX; col++) {
                const cell = this.cell(col, row);

                if (!cell.item) {
                    continue;
                }

                if (cell.isItemRoot()) {
                    box.push({ x: col, y: row, cell: cell, item: cell.item });
                }

                // Skip the rest of the item
                col += cell.item.getWidth() - 1;
            }
        }

        return box;
    }

    /**
     * Add event listener.
     * @param {String|Array} event
     * @param {Function} listener
     */
    on(event, listener) {
        if (typeof event === 'object') {
            for (const index of event) {
                this._addHandler(event[index], listener);
            }
        } else {
            this._addHandler(event, listener);
        }
    }

    /**
     * Remove event listener.
     * @param {String|Array} event
     * @param {Function} listener
     */
    off(event, listener) {
        if (typeof event === 'object') {
            for (const index in event) {
                this._removeHandler(event[index], listener);
            }
        } else {
            this._removeHandler(event, listener);
        }
    }

    /**
     * Emit event.
     * @param {String} event
     * @param {*} args
     */
    emit(event, ...args) {
        if (!this._listeners[event]) {
            return;
        }

        for (const handler in this._listeners[event]) {
            this._listeners[event][handler](...args);
        }
    }

    /**
     * Create IsoDom grid.
     * @private
     */
    _init() {
        // Create main grid
        const grid = document.createElement('div');
        grid.classList.add(this.config.gridClass);
        grid.style.width = (this.config.columns * this.config.cellSize[0]) + ((this.config.columns + this.config.cellSize[0]) / 2) + 'px';
        grid.style.height = (this.config.rows * this.config.cellSize[1]) + ((this.config.columns + this.config.cellSize[1]) / 2) + 'px';

        if (this.config.debug) {
            grid.classList.add(`${this.config.gridClass}--debug`);
        }

        // Create item container
        const itemContainer = document.createElement('div');
        itemContainer.classList.add(this.config.itemContainerClass);

        for (let y = 0; y < this.config.rows; y++) {
            for (let x = 0; x < this.config.columns; x++) {
                const node = document.createElement('div');
                node.classList.add(this.config.columnClass);
                node.setAttribute('column', x);
                node.setAttribute('row', y);
                node.style.width = this.config.cellSize[0] + "px";
                node.style.height = this.config.cellSize[1] + "px";

                node.__isodomcell__ = new IsoDomCell(this, node, x, y);
                this._mapCell(node.__isodomcell__);

                // Call on cell created user callback
                this.emit('cellCreated', node, node.__isodomcell__, this);

                grid.appendChild(node);
            }
        }

        // Clear grid elements
        this.config.target.innerHTML = '';

        // Add grid and item container to DOM
        this.config.target.appendChild(grid);
        this.config.target.appendChild(itemContainer);

        this.grid = grid;
        this.itemContainer = itemContainer;
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
            return;
        }

        cells.forEach(cell => {
            cell.setItem(null, null);
            cell.update();
        });
    }

    // Set cell index
    _setIndex(cell) {
        const limiters = [];

        const zones = this.itemsInArea(0, 0, cell.x + cell.item.getWidth(), cell.y + cell.item.getHeight());

        for (const zoneIndex in zones) {
            const zone = zones[zoneIndex];
            if (zone.item !== cell.item && zone.cell.z) {
                limiters.push(zone.cell.z);
            }
        }

        cell.z = limiters.length ? Math.max(...limiters) + 1 : cell.y + 1 + cell.x;
    };

    /**
     * Move along the item render path and update z index.
     * @param {Number} col
     * @param {Number} row
     * @private
     */
    _renderPath(col, row) {
        for (let x = col; x < this.config.columns; x++) {
            const cell = this.cell(x, row);

            if (cell.item) {
                if (cell.isItemRoot()) {
                    this._setIndex(cell);
                } else {
                    const rootCell = cell.getRootCell();
                    for (let y = rootCell.y; y <= row; y++) {
                        if (y === rootCell.y) {
                            this._renderPath(x, y);
                        } else {
                            this._renderPath(x + rootCell.item.getWidth(), y);
                        }
                    }
                }

                x += cell.item.getWidth() - 1;
            }
        }
    }

    /**
     * Add event handler.
     * @param {String} event
     * @param {Function} listener
     * @private
     */
    _addHandler(event, listener) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }

        this._listeners[event].push(listener);
    }

    /**
     * Remove event handler.
     * @param {String} event
     * @param {Function} listener
     * @private
     */
    _removeHandler(event, listener) {
        if (!this._listeners[event]) {
            return;
        }

        const index = this._listeners[event].indexOf(listener);
        if (index >= 0) {
            this._listeners[event].splice(index, 1);
        }
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
