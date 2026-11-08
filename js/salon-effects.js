/**
 * VIBE Salon Effects — Glassmorphism et animations immersives
 */
(function () {
  'use strict';

  function animateSalon(salonId, canvas) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth);
    const h = (canvas.height = 200);

    let particles = [];
    let t = 0;

    class Particle {
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.life = 1;
        this.decay = Math.random() * 0.01 + 0.003;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;

        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h;
        if (this.y > h) this.y = 0;
      }

      draw(ctx, color) {
        ctx.fillStyle = color.replace('ALPHA', this.life * 0.6);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.5 + this.life * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const colors = {
      flottant: 'rgba(212,175,55,ALPHA)',
      voix: 'rgba(0,238,255,ALPHA)',
      fantomes: 'rgba(180,180,255,ALPHA)'
    };

    const particleColor = colors[salonId] || colors.flottant;

    function animate() {
      ctx.clearRect(0, 0, w, h);

      while (particles.length < 25) particles.push(new Particle());
      particles = particles.filter(p => p.life > 0);

      particles.forEach(p => {
        p.update();
        p.draw(ctx, particleColor);
      });

      if (t % 6 === 0) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 100) {
              const alpha = (1 - d / 100) * 0.15;
              ctx.strokeStyle = particleColor.replace('ALPHA', alpha);
              ctx.lineWidth = 0.75;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      t++;
      if (window._activeSalonAnim === animate) {
        requestAnimationFrame(animate);
      }
    }

    window._activeSalonAnim = animate;
    animate();
  }

  window.animateSalon = animateSalon;
})();
