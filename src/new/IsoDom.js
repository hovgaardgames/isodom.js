/**
 * @typedef {Class} IsoDomConductor
 * @property {function(IsoDom)} setIsoDom
 */

/**
 * @typedef {Object} IsoDomEvents
 * @property {function(IsoDom)} [afterInit]
 * @property {function(IsoDom)} [beforeInit]
 * @property {function(IsoDomCell, IsoDom)} [cellCreated]
 * @property {function(IsoDomItem, IsoDomCell, IsoDom)} [itemAdded]
 * @property {function(IsoDomCell, IsoDom)} [renderCell]
 * @property {function(IsoDom)} [draw]
 * @property {function(IsoDomItem, IsoDomCell, IsoDomCell, IsoDom)} [itemMoved]
 */

/**
 * @typedef {Object} IsoDomItemImage
 * @property {string} url
 * @property {{ top: number, left: number }} offset
 */

/**
 * @typedef {Object} IsoDomItemConfig
 * @property {string} [orientation]
 * @property {number[]} [size]
 * @property {IsoDomItemImage[]} [images]
 */

/**
 * @typedef {Object} IsoDomConfig
 * @property {boolean} [debug]
 * @property {IsoDomItemConfig} [items]
 * @property {IsoDomEvents} [events]
 * @property {number[]} [cellSize]
 * @property {number} [rows]
 * @property {number} [columns]
 * @property {number} [step]
 * @property {string[]} [orientationOrder]
 */

/**
 * @class IsoDomCell
 * @property {IsoDom} iso
 * @property {number} x
 * @property {number} y
 * @property {number|null} =z
 * @property {Object.<string, *>} meta
 * @property {IsoDomItem|null} item
 * @property {IsoDomCell|null} itemRootCell
 */
class IsoDomCell {
    /**
     * IsoDomCell constructor.
     * @param {IsoDom} isoDom
     * @param {number} x
     * @param {number} y
     */
    constructor(isoDom, x, y) {
        this.iso = isoDom;
        this.x = x;
        this.y = y;
        this.z = null;
        this.meta = {};
        this.item = null;
        this.itemRootCell = null;
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
     * Determine if the cell contains item root.
     * @returns {boolean}
     */
    isItemRoot() {
        return this.itemRootCell === this;
    }

    /**
     * Get root cell.
     * @returns {IsoDomCell|null}
     */
    getRootCell() {
        return this.itemRootCell;
    }
}

/**
 * @class IsoDomItem
 * @property {IsoDomCell} cell
 * @property {IsoDomItemConfig} defaults
 * @property {IsoDom} iso
 * @property {string} name
 * @property {Object.<string, *>} meta
 * @property {string} orientation
 */
class IsoDomItem {
    /**
     * IsoDomItem constructor.
     * @param {IsoDom} isoDom
     * @param {string} name
     * @param {Object.<string, *>} config
     */
    constructor(isoDom, name, config = {}) {
        this.cell = null;
        this.defaults = isoDom.getItemConfig(name);
        if (!this.defaults) {
            throw new Error(`IsoDom controlling the item does not contain "${name}" item configuration.`);
        }

        this.iso = isoDom;
        this.name = name;
        this.meta = {};

        Object.assign(this, config);

        // Current item orientation
        if (!this.orientation) {
            this.orientation = config.orientation || this.defaults.orientation;
        }
    }

    /**
     * Get image source.
     * @returns {IsoDomItemImage}
     */
    image() {
        return this.defaults.images[this.orientation];
    }

    /**
     * Get item width.
     * @returns {number}
     */
    getWidth() {
        const horizontal = [IsoDom.ORIENTATION_SW, IsoDom.ORIENTATION_NE].includes(this.orientation);
        return this.defaults.size[horizontal ? 0 : 1];
    }

    /**
     * Get item height.
     * @returns {number}
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
        const current = this.iso.config.orientationOrder.indexOf(this.orientation);
        let next = clockwise ? current + 1 : current - 1;

        if (next < 0) {
            next = this.iso.config.orientationOrder.length - 1;
        } else if (next >= this.iso.config.orientationOrder.length) {
            next = 0;
        }

        this.orientate(this.iso.config.orientationOrder[next]);
        this.update();
        this.iso.emit('itemRotated', this);
    }

    /**
     * Orientate item to specific direction.
     * @param {String} orientation
     */
    orientate(orientation) {
        if (!this.defaults.images[orientation]) {
            throw new Error(`Invalid orientation ("${orientation}") provided for ${this.name} item.`);
        }

        this.orientation = orientation;
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
}

/**
 * @class IsoDom
 * @property {IsoDomConductor} conductor
 * @property {IsoDomConfig} config
 */
class IsoDom {
    /**
     * IsoDom constructor.
     * Create new instance of IsoDom.
     * @param {IsoDomConductor} conductor
     * @param {IsoDomConfig} config
     */
    constructor(conductor, config = {}) {
        this._listeners = {};
        this.conductor = conductor;
        this.items = [];
        this.cellMap = new Map();
        this.config = {
            debug: false,
            items: {},
            cellSize: [100, 100],
            rows: 10,
            columns: 10,
            step: 1,
            orientationOrder: [IsoDom.ORIENTATION_SW, IsoDom.ORIENTATION_NW, IsoDom.ORIENTATION_NE, IsoDom.ORIENTATION_SE],
            events: {},
        };

        Object.assign(this.config, config);
        conductor.setIsoDom(this);

        // Attach events, some events like cellCreated can only be triggered from config.events.
        this.on(this.config.events);

        this._init();
    }

    /**
     * Get state if currently debugging.
     * @return {boolean}
     */
    isDebugging() {
        return this.config.debug;
    }

    /**
     * Execute DOM update (aka. calculate z-indexes).
     * @param {number} col Beginning column.
     * @param {number} row Beginning row.
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
                    // We found the first item in the row, leaving the rest for the _renderPath.
                    this._renderPath(x, y);
                    break;
                } else if (partial && x === col && y > row) {
                    // It happened that during a partial update the next rows contain items
                    // that actually start x - 1 or lower so to make sure that item has higher z-index,
                    // we run it's render path from its root cell.
                    const root = cell.getRootCell();
                    this._renderPath(root.x, root.y);

                    // Skip the remaining height of the item to avoid rendering it multiple times.
                    row += root.item.getHeight();
                    break;
                }
            }
        }

        // Update cells
        this.cellMap.forEach((cell) => {
            this.emit('renderCell', cell);
        });

        this.emit('draw', this);
    }

    /**
     * Add item to the grid.
     * @param {IsoDomItem|string} item
     * @param {number} x
     * @param {number} y
     * @param {Object.<string, *>} config Config value for IsoDomItem if constructing by item name.
     * @returns {IsoDomItem}
     */
    addItem(item, x, y, config = null) {
        let isoItem = item;
        if (typeof item === 'string') {
            isoItem = this.makeItem(item, config);
        }

        this.assertItemPlacement(isoItem, x, y, false);
        const rootCell = this.cell(x, y);
        this._mapItemToCells(isoItem, rootCell);
        isoItem.cell = rootCell;
        this.items.push(isoItem);

        this.emit('itemAdded', isoItem, rootCell, this);

        return isoItem;
    }

    /**
     * Create new IsoDomItem.
     * @param {string} name
     * @param {Object.<string, *>} config
     * @returns {IsoDomItem}
     */
    makeItem(name, config = {}) {
        return new IsoDomItem(this, name, config);
    }

    /**
     * Move item to another place.
     * If item does not exist in the grid, it will be added.
     * @param {IsoDomItem} item
     * @param {number} x
     * @param {number} y
     */
    moveItem(item, x, y) {
        if (!item.cell) {
            this.addItem(item, x, y);
            return;
        }

        this.assertItemPlacement(item, x, y, true);
        const fromCell = item.cell;
        const toCell = this.cell(x, y);

        this._unmapItemFromCells(item);
        this._mapItemToCells(item, toCell);

        item.cell = toCell;

        this.emit('itemMoved', item, fromCell, toCell, this);
    }

    /**
     * Assert item placement on cell:
     * - the cell is valid;
     * - the item would not go out of bounds;
     * - the area for the item is not taken by another item.
     * @param {IsoDomItem} item
     * @param {number} x
     * @param {number} y
     * @param {boolean} ignoringItem
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
     * Determine if area is taken.
     * @param {number} startX
     * @param {number} startY
     * @param {number} endX
     * @param {number} endY
     * @param {IsoDomItem} ignoreItem
     * @returns {boolean}
     */
    isAreaTaken(startX, startY, endX, endY, ignoreItem = null) {
        return this.takenCells(startX, startY, endX, endY, ignoreItem).length > 0;
    }

    /**
     * Determine if an item would go out of bounds when placed on position.
     * @param {IsoDomItem} item
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isOutOfBounds(item, x, y) {
        return !Boolean(this.cell(x + item.getWidth() - 1, y + item.getHeight() - 1));
    }

    /**
     * Get all taken cells in area.
     * @param {number} startX
     * @param {number} startY
     * @param {number} endX
     * @param {number} endY
     * @param {IsoDomItem} ignoreItem
     * @returns {boolean}
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
     * Array of cell boxes.
     * @param {number} startX
     * @param {number} startY
     * @param {number} endX
     * @param {number} endY
     * @returns {{ x: number, y: number, cell: IsoDomCell, item: IsoDomItem}[]}
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
     * Get item default config.
     * @param {string} name
     * @returns {IsoDomItemConfig}
     */
    getItemConfig(name) {
        return this.config.items[name];
    }

    /**
     * Get a cell at position.
     * @param {number} x
     * @param {number} y
     * @return {IsoDomCell|undefined}
     */
    cell(x, y) {
        return this.cellMap.get(IsoDom.cellID(x, y));
    }

    /**
     * Find IsoDomItem root cell.
     * @param {IsoDomItem} item
     * @returns {IsoDomCell[]|null}
     */
    findItemCells(item) {
        const cells = [];
        const rootCell = item.cell;

        if (!rootCell) {
            console.warn('Item does is not attached to any cells.');
            return cells;
        }

        const distance = Math.max(item.getWidth(), item.getHeight());
        const boundaryX = Math.min(rootCell.x + distance, this.config.columns);
        const boundaryY = Math.min(rootCell.y + distance, this.config.rows);
        for (let x = rootCell.x; x < boundaryX; x++) {
            for (let y = rootCell.y; y < boundaryY; y++) {
                const cell = this.cell(x, y);
                if (cell.item === item) {
                    cells.push(cell);
                }
            }
        }

        return cells;
    }

    /**
     * Add event listener.
     * @param {string|Array|IsoDomEvents|Object.<string, function>} event
     * @param {function|null} [listener]
     */
    on(event, listener = null) {
        if (Array.isArray(event)) {
            for (const index in event) {
                this._addHandler(event[index], listener);
            }
        } else if (typeof event === 'object') {
            for (let eventName in event) {
                if (!event.hasOwnProperty(eventName)) {
                    continue;
                }

                this.on(eventName, event[eventName]);
            }
        } else {
            this._addHandler(event, listener);
        }
    }

    /**
     * Remove event listener.
     * @param {string|Array} event
     * @param {function} listener
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
     * @param {string} event
     * @param {*} args
     */
    emit(event, ...args) {
        if (!this._listeners[event]) {
            return;
        }

        for (const handler in this._listeners[event]) {
            if (!this._listeners[event].hasOwnProperty(handler)) {
                continue;
            }

            this._listeners[event][handler](...args);
        }
    }

    /**
     * Initialize IsoDom.
     * @private
     */
    _init() {
        this.emit('beforeInit', this);

        for (let y = 0; y < this.config.rows; y++) {
            for (let x = 0; x < this.config.columns; x++) {
                const cell = new IsoDomCell(this, x, y);
                this._mapCell(cell);

                // Call on cell created user callback
                this.emit('cellCreated', cell, this);
            }
        }

        this.emit('afterInit', this);
    }

    /**
     * Map IsoDomCell.
     * @param {IsoDomCell} cell
     * @private
     */
    _mapCell(cell) {
        this.cellMap.set(IsoDom.cellID(cell.x, cell.y), cell);
    }

    /**
     * Map item to cells.
     * @param {IsoDomItem} item
     * @param {IsoDomCell} rootCell
     * @private
     */
    _mapItemToCells(item, rootCell) {
        const xEnd = rootCell.x + item.getWidth();
        const yEnd = rootCell.y + item.getHeight();
        for (let x = rootCell.x; x < xEnd; x++) {
            for (let y = rootCell.y; y < yEnd; y++) {
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
        });
    }

    /**
     * Add event handler.
     * @param {string} event
     * @param {function} listener
     * @private
     */
    _addHandler(event, listener) {
        if (!this._listeners.hasOwnProperty(event)) {
            this._listeners[event] = [];
        }

        this._listeners[event].push(listener);
    }

    /**
     * Remove event handler.
     * @param {string} event
     * @param {function} listener
     * @private
     */
    _removeHandler(event, listener) {
        if (!this._listeners.hasOwnProperty(event)) {
            return;
        }

        const index = this._listeners[event].indexOf(listener);
        if (index >= 0) {
            this._listeners[event].splice(index, 1);
        }
    }

    /**
     * Move along the item render path and update z index.
     * @param {number} col
     * @param {number} row
     * @private
     */
    _renderPath(col, row) {
        for (let x = col; x < this.config.columns; x++) {
            const cell = this.cell(x, row);

            if (!cell.item) {
                continue;
            }

            if (cell.isItemRoot()) {
                // Cell is item root so we can calculate it's index because all dependencies are already calculated.
                this._setIndex(cell);
            } else {
                // Cell is not item root, so it's an item that starts higher (y - 1 or higher),
                // this item will require z-index recalculation so that we don't overlap it.
                const rootCell = cell.getRootCell();
                for (let y = rootCell.y; y <= row; y++) {
                    if (y === rootCell.y) {
                        // Calculate the render path of the obstacles root cell.
                        this._renderPath(x, y);
                    } else {
                        // Skip the obstacle on the next row(s) until we match our row and (re)calculate any item
                        // that depends on the obstacle.
                        this._renderPath(x + rootCell.item.getWidth(), y);
                    }
                }
            }

            // Skip remaining item cells
            x += cell.item.getWidth() - 1;
        }
    }

    /**
     * Set cell index.
     * @param {IsoDomCell} cell
     * @private
     */
    _setIndex(cell) {
        const limiters = [];
        const itemsInArea = this.itemsInArea(0, 0, cell.x + cell.item.getWidth(), cell.y + cell.item.getHeight());

        for (const index in itemsInArea) {
            const item = itemsInArea[index];
            if (item.item !== cell.item && item.cell.z) {
                limiters.push(item.cell.z);
            }
        }

        cell.z = limiters.length ? Math.max(...limiters) + this.config.step : cell.y + this.config.step + cell.x;
    };

    /**
     * Get cell ID.
     * @param {number} x
     * @param {number} y
     * @return {string}
     */
    static cellID(x, y) {
        return `${x}-${y}`;
    }
}

IsoDom.ORIENTATION_N = 'N';   // ↑
IsoDom.ORIENTATION_NE = 'NE'; // ↗
IsoDom.ORIENTATION_E = 'E';   // →
IsoDom.ORIENTATION_SE = 'SE'; // ↘
IsoDom.ORIENTATION_S = 'S';   // ↓
IsoDom.ORIENTATION_SW = 'SW'; // ↙
IsoDom.ORIENTATION_W = 'W';   // ←
IsoDom.ORIENTATION_NW = 'NW'; // ↖
