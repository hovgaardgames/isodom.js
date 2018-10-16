class IsoDomCell2 {
    /**
     * Create new instance of IsoDomCell.
     * @param {IsoDom} isoDom
     * @param {HTMLElement} el
     * @param {Number} x
     * @param {Number} y
     */
    constructor(isoDom, el, x, y) {
        this.el = el;
        this._cachePosition = null;

        this.update();
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
}

class IsoDomItem2 {
    constructor(name, isoDom, config = {}) {
        /** @type {HTMLElement} */
        this.el = null;
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
        this.update();
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

class IsoDom2 {
    constructor(config = {}) {
        this.config = {
            plugins: [],
        };

        // Install plugins
        this.config.plugins.forEach(plugin => {
            plugin.install(this);
        });

        this.on(['itemAdded', 'itemRemoved', 'itemMoved'], () => {
            this.emit('itemsChanged', this);
        });
    }

    /**
     * Place item on grid.
     * @param {IsoDomItem} item
     * @param {Number} x
     * @param {Number} y
     */
    addItem(item, x, y) {
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
     * Remove item from DOM.
     * @param {IsoDomItem} item
     */
    unmountItem(item) {
        if (!item.el) {
            return;
        }

        item.el.parentNode.removeChild(item.el);
        item.setElement(null);
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
}
