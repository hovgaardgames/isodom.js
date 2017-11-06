class IsoDomDragAndDrop {
    /**
     * Initialize plugin properties.
     */
    constructor() {
        /** @type IsoDom */
        this.isoDom = null;
        /** @type IsoDomItem */
        this.item = null;
        this.initialOrientation = null;
        this.destinationCell = null;
    }

    /**
     * Determine if already dragging an item.
     * @returns {boolean}
     */
    isDragging() {
        return Boolean(this.item);
    }

    /**
     * Set destination cell.
     * @param {IsoDomCell} cell
     */
    setDestination(cell) {
        this.destinationCell = cell;
        this.item.positionOnCell(cell);
    }

    /**
     * Return closest cell that does not go out of bounds.
     * @param {IsoDomCell} cell
     * @returns {IsoDomCell}
     */
    closestInBoundCell(cell) {
        let x = cell.x;
        let y = cell.y;

        if (cell.x + this.item.getWidth() > this.isoDom.config.columns) {
            x = this.isoDom.config.columns - this.item.getWidth();
        }

        if (cell.y + this.item.getHeight() > this.isoDom.config.rows) {
            y = this.isoDom.config.rows - this.item.getHeight();
        }

        return this.isoDom.cell(x, y);
    }

    /**
     * Cancel drag.
     */
    cancel() {
        if (!this.item) {
            return;
        }

        const itemCell = this.item.rootCell();

        if (itemCell) {
            this.item.orientation = this.initialOrientation;
            this.item.update(); // Restore image orientation
            itemCell.update(); // Restore z-index
        } else {
            this.item.unmount();
        }

        this.isoDom.emit('dragEnd', true, this); // canceled = true

        this._reset();
    }

    /**
     * Start dragging of an item.
     * @param {IsoDomItem} item
     */
    start(item) {
        if (!item.rootCell()) {
            item.mount();
        }

        this.item = item;
        this.initialOrientation = item.orientation;
        item.el.style.zIndex = '99999';

        this.isoDom.emit('dragStart', this.item, this);
    }

    /**
     * Confirm new item position and move it or add it to the grid.
     */
    commit() {
        if (!this.isDragging() || !this.destinationCell) {
            return;
        }

        this.isoDom.moveItem(this.item, this.destinationCell.x, this.destinationCell.y);
        this.isoDom.draw();

        this.isoDom.emit('itemDrop', this.item, this.destinationCell, this);
        this.isoDom.emit('dragEnd', false, this); // canceled = false

        this._reset();
    }

    /**
     * Install plugin for IsoDom instance.
     * @param {IsoDom} isoDom
     */
    install(isoDom) {
        this.isoDom = isoDom;

        this.isoDom.on('itemRemoved', item => {
            if (item === this.item) {
                this.cancel();
            }
        });
    }

    /**
     * Reset properties.
     * @private
     */
    _reset() {
        this.item = null;
        this.initialOrientation = null;
    }
}
