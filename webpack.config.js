module.exports = {
    entry: "./src/IsoDom.js",
    devServer: {
        contentBase: "./src/",
        watchContentBase: true
    },
    watchOptions: {
        ignored: /node_modules/
    }
};
