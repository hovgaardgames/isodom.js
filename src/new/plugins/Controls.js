class IsoDomControls {
    constructor(conductor) {
        this.conductor = conductor;
        this.dragging = {mousePressed: false, active: false, startX: 0, startY: 0, endX: 0, endY: 0};
        this._init();
    }

    _adjustView() {
        let backgroundBounds = iso.background.getBounds();
        let scale = iso.conductor.itemsStage.scale;
        let minX = iso.conductor.config.itemsTarget.width - (backgroundBounds.width * scale) - (iso.background.x * scale);
        let maxX = Math.abs(iso.background.x) * scale;

        let minY = iso.conductor.config.itemsTarget.height - (backgroundBounds.height * scale) - (iso.background.y * scale);
        let maxY = Math.abs(iso.background.y) * scale;

        if (iso.conductor.itemsStage.x > maxX) {
            iso.conductor.itemsStage.x = maxX;
        }

        if (iso.conductor.itemsStage.x < minX) {
            iso.conductor.itemsStage.x = minX;
        }

        if (iso.conductor.itemsStage.y > maxY) {
            iso.conductor.itemsStage.y = maxY;
        }

        if (iso.conductor.itemsStage.y < minY) {
            iso.conductor.itemsStage.y = minY;
        }
    };

    _setMininmumScale()  {
        // Set scale
        let backgroundBounds = iso.background.getBounds();
        iso.minimumScale = Math.ceil(Math.max(
            (iso.conductor.gridStage._viewportHeight * 100 / (backgroundBounds.height + iso.background.y)),
            (iso.conductor.gridStage._viewportWidth * 100 / (backgroundBounds.width + iso.background.x))
        )) / 100;

        iso.conductor.gridStage.scale = iso.minimumScale;
        iso.conductor.itemsStage.scale = iso.minimumScale;
        this._adjustView();
    };

    _setupWasd() {
        window.addEventListener('keydown', e => {
            let wasdStepSize = 10;
            switch (e.code) {
                case 'KeyW':
                    this.conductor.itemsStage.y += wasdStepSize;
                    this.conductor.gridStage.y += wasdStepSize;
                    break;
                case 'KeyA':
                    this.conductor.itemsStage.x += wasdStepSize;
                    this.conductor.gridStage.x += wasdStepSize;
                    break;
                case 'KeyS':
                    this.conductor.itemsStage.y -= wasdStepSize;
                    this.conductor.gridStage.y -= wasdStepSize;
                    break;
                case 'KeyD':
                    this.conductor.itemsStage.x -= wasdStepSize;
                    this.conductor.gridStage.x -= wasdStepSize;
                    break;
            }
        });
    }

    _setupResizing() {
        window.addEventListener('resize', () => {
            for (let stage of [iso.conductor.gridStage, iso.conductor.itemsStage]) {
                stage.canvas.width = window.innerWidth;
                stage.canvas.height  = window.innerHeight;
                stage.updateViewport(window.innerWidth, window.innerHeight);
                this._adjustView();
            }

            this._setMininmumScale();
        });
    }

    _setupZooming() {
        this.conductor.itemsStage.canvas.addEventListener('wheel', e => {
            let isScrollDown = e.deltaY > 0;

            let scale = 1;
            if (isScrollDown) {
                if (iso.minimumScale < this.conductor.itemsStage.scale) {
                    scale = Math.max(this.conductor.itemsStage.scale - 0.1, iso.minimumScale);
                    this.conductor.itemsStage.scale = scale;
                    this.conductor.gridStage.scale = scale;
                }
            } else {
                if (this.conductor.itemsStage.scale < 1) {
                    scale = Math.min(this.conductor.itemsStage.scale + 0.1, 1);
                    this.conductor.itemsStage.scale = scale;
                    this.conductor.gridStage.scale = scale;
                }
            }

            this.conductor.itemsStage.x *= scale;
            this.conductor.itemsStage.y *= scale;

            this._adjustView();
        });
    }

    _setupMousePanning() {
        this.conductor.itemsStage.on('stagemouseup', (event) => {
            this.dragging.mousePressed = false;
            setTimeout(() => {
                this.dragging.active = false;
            }, 10);
        });
        this.conductor.itemsStage.on('stagemousedown', (event) => {
            this.dragging.mousePressed = true;
            this.dragging.startX = event.stageX;
            this.dragging.startY = event.stageY;
        });
        this.conductor.itemsStage.on('stagemousemove', (event) => {
            if (!this.dragging.mousePressed) return;

            this.dragging.endX = event.stageX;
            this.dragging.endY = event.stageY;

            let xDiff = this.dragging.endX - this.dragging.startX;
            let yDiff = this.dragging.endY - this.dragging.startY;

            if (Math.abs(xDiff) > 3 && Math.abs(yDiff) > 3 && !this.dragging.active) {
                this.dragging.active = true;
            }

            if (this.dragging.active) {
                console.log(`The diff is: X: ${ xDiff } Y: ${ yDiff }`);

                const scale = iso.conductor.itemsStage.scale;

                // Figure out if we should stop moving because of out-of-bounds
                let backgroundBounds = iso.background.getBounds();

                let minX = iso.conductor.config.itemsTarget.width - (backgroundBounds.width * scale) - (iso.background.x * scale);
                let maxX = Math.abs(iso.background.x) * scale;

                let minY = iso.conductor.config.itemsTarget.height - (backgroundBounds.height * scale) - (iso.background.y * scale);
                let maxY = Math.abs(iso.background.y) * scale;

                let newX = iso.conductor.itemsStage.x + xDiff;
                let newY = iso.conductor.itemsStage.y + yDiff;

                // Handle X
                if ((newX * scale) > (minX * scale) && (newX * scale) < (maxX * scale)) {
                    iso.conductor.itemsStage.x = newX;
                    iso.conductor.gridStage.x = newX;
                }

                // Handle Y
                if ((newY * scale) > (minY * scale) && (newY * scale) < (maxY * scale)) {
                    iso.conductor.itemsStage.y = newY;
                    iso.conductor.gridStage.y = newY;
                }

                this.dragging.startX = event.stageX;
                this.dragging.startY = event.stageY;

                console.log('mouse move!');
            }
        });
    }

    /**
     * Setup listeners.
     * @private
     */
    _init() {
        this._setupMousePanning();
        this._setupResizing();
        this._setupZooming();
        this._setupWasd();
        this._setMininmumScale();
    }
}