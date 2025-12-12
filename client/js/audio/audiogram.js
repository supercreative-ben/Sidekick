export class Audiogram {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas?.getContext('2d') || null;
        this.analyser = null;
        this.analyserInput = null;
        this.streamerGainNode = null;
        this.animationId = null;
        this.isActive = false;
        this.barCount = 24;
        this.barGap = 2;
        this.decay = 0.08;
        this.levels = new Array(this.barCount).fill(0);

        if (this.canvas && this.ctx) {
            this.resize = this.resize.bind(this);
            this.animate = this.animate.bind(this);
            window.addEventListener('resize', this.resize);
            this.resize();
        }
    }

    attachAudio(streamer) {
        if (!streamer || !streamer.context || !streamer.gainNode) return;

        this.cleanupConnections();

        const audioContext = streamer.context;
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.7;

        this.analyserInput = audioContext.createGain();
        this.streamerGainNode = streamer.gainNode;

        this.streamerGainNode.connect(this.analyserInput);
        this.analyserInput.connect(this.analyser);
    }

    start() {
        if (!this.analyser || !this.ctx) return;
        if (this.isActive) return;
        this.isActive = true;
        this.animate();
    }

    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.fadeOut();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    animate() {
        if (!this.isActive || !this.analyser || !this.ctx) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const barWidth = (this.canvas.width - (this.barGap * (this.barCount - 1))) / this.barCount;
        const slice = Math.max(1, Math.floor(bufferLength / this.barCount));

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.barCount; i++) {
            const start = i * slice;
            const end = Math.min(bufferLength, start + slice);
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += dataArray[j];
            }
            const average = sum / (end - start || 1);
            const normalized = Math.max(average / 255, 0.05);
            const targetHeight = normalized * this.canvas.height;

            this.levels[i] = (1 - this.decay) * this.levels[i] + this.decay * targetHeight;

            const x = i * (barWidth + this.barGap);
            const y = this.canvas.height - this.levels[i];

            const gradient = this.ctx.createLinearGradient(0, y, 0, this.canvas.height);
            gradient.addColorStop(0, 'rgba(136, 136, 136, 0.9)');
            gradient.addColorStop(1, 'rgba(104, 104, 104, 0.2)');

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, y, barWidth, this.levels[i]);
        }

        this.animationId = requestAnimationFrame(this.animate);
    }

    fadeOut() {
        if (!this.ctx || !this.canvas) return;
        const fadeSteps = 10;
        let step = fadeSteps;

        const fade = () => {
            if (step <= 0) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                return;
            }
            this.ctx.globalAlpha = step / fadeSteps;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1;
            step--;
            requestAnimationFrame(fade);
        };

        fade();
    }

    cleanupConnections() {
        if (this.streamerGainNode && this.analyserInput) {
            try {
                this.streamerGainNode.disconnect(this.analyserInput);
            } catch (error) {
                console.debug('Audiogram disconnect error', error);
            }
        }
        if (this.analyserInput) {
            try {
                this.analyserInput.disconnect();
            } catch (error) {
                console.debug('Audiogram analyserInput disconnect error', error);
            }
        }
        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (error) {
                console.debug('Audiogram analyser disconnect error', error);
            }
        }
        this.analyser = null;
        this.analyserInput = null;
        this.streamerGainNode = null;
    }

    cleanup() {
        this.stop();
        this.cleanupConnections();
    }

    destroy() {
        this.cleanup();
        if (this.canvas && this.resize) {
            window.removeEventListener('resize', this.resize);
        }
        this.canvas = null;
        this.ctx = null;
    }
}
