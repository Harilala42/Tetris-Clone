"use strict";

global.document = {
    getElementById: (id) => {
        // Mock audio elements
        if (id === 'background-music' || id === 'line-clear-sound' || id === 'game-over-sound') {
            return {
                play: () => ({
                    then: (cb) => cb(),
                    catch: () => {}
                }),
                pause: () => {},
                volume: 1.0,
                currentTime: 0,
                loop: false,
                addEventListener: () => {}
            };
        }

        // Mock canvas
        if (id === 'canvas') {
            return {
                getContext: () => ({
                    drawImage: () => {},
                    clearRect: () => {},
                    fillRect: () => {},
                    createLinearGradient: () => ({
                        addColorStop: () => {}
                    }),
                    fillStyle: '',
                    strokeStyle: '',
                    lineWidth: 1,
                    beginPath: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    stroke: () => {},
                    font: '',
                    textAlign: '',
                    textBaseline: '',
                    strokeText: () => {},
                    fillText: () => {},
                    shadowColor: '',
                    shadowBlur: 0,
                    shadowOffsetX: 0,
                    shadowOffsetY: 0
                }),
                width: 440,
                height: 660,
                style: {},
                addEventListener: () => {}
            };
        }

        // Mock buttons
        if (id === 'pause' || id === 'restart') {
            return {
                addEventListener: () => {}
            };
        }

        return {};
    },
    fonts: {
        load: () => Promise.resolve()
    },
    addEventListener: () => {},
    querySelector: () => ({ clientWidth: 1980 })
};

global.window = {
    localStorage: {
        getItem: () => "0",
        setItem: () => {}
    },
    addEventListener: () => {}
};

global.requestAnimationFrame = (cb) => setInterval(cb, 0);
