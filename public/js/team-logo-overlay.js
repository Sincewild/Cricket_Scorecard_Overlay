    const query = new URLSearchParams(window.location.search);
    const isSpotlightDemoMode = query.get('demoSpotlight') === '1';
    const isSpotlightPinned = query.get('spotlightAlways') === '1';

    let prevState = {};
    let hasBaselineState = false;
    let fullcardTimeout = null;
    let prevOverCount = 0;
    let prevThisOverLength = 0;
    let spotlightTimeout = null;

    // Partnership tracking: runs/balls accumulated since the current pair came together.
    let partnershipState = {
      startScore: 0,
      startBatRuns: 0,
      startBalls: 0,
      lastWkts: null
    };

    function getInitials(name) {
      const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return '--';
      if (parts.length === 1) return parts[0].slice(0, 2);
      return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    }

    function formatBatterScore(runs, balls) {
      const r = runs !== null && runs !== undefined && runs !== '' ? runs : '-';
      const b = balls !== null && balls !== undefined && balls !== '' ? balls : '-';
      return `${r} (${b})`;
    }

    function formatRate(value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric.toFixed(2) : '-';
    }

    function toInt(value) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function getInningsContext(score) {
      if (score.runsNeeded || score.ballsLeft) return 'CHASING';
      if (score.score2 || score.overs2) return '2ND INNINGS';
      return '1ST INNINGS';
    }

    function getCurrentInningsScore(score) {
      const battingSecondInnings = score.score2 !== null && score.score2 !== undefined;
      return {
        runs: toInt(battingSecondInnings ? score.score2 : score.score1),
        wkts: toInt(battingSecondInnings ? score.wkts2 : score.wkts1)
      };
    }

    // Resets the partnership baseline whenever a wicket falls (or on first load).
    function updatePartnershipState(score) {
      const { runs, wkts } = getCurrentInningsScore(score);
      if (partnershipState.lastWkts === null || wkts !== partnershipState.lastWkts) {
        partnershipState.startScore = runs;
        partnershipState.startBatRuns = toInt(score.bat1r) + toInt(score.bat2r);
        partnershipState.startBalls = toInt(score.bat1b) + toInt(score.bat2b);
        partnershipState.lastWkts = wkts;
      }
    }

    function getPartnershipText(score) {
      const { runs: teamRuns } = getCurrentInningsScore(score);
      const partnershipRuns = teamRuns - partnershipState.startScore;
      const balls = (toInt(score.bat1b) + toInt(score.bat2b)) - partnershipState.startBalls;

      if (partnershipRuns <= 0 && balls <= 0) {
        return 'Partnership: -';
      }

      const batterRuns = (toInt(score.bat1r) + toInt(score.bat2r)) - partnershipState.startBatRuns;
      const extras = partnershipRuns - batterRuns;

      let text = `Partnership: ${partnershipRuns} (${balls})`;
      if (extras > 0) text += ` incl ${extras} extra${extras === 1 ? '' : 's'}`;
      return text;
    }

    function setSpotlightAvatar(avatarId, batterName, photoUrl) {
      const avatar = document.getElementById(avatarId);
      const initials = getInitials(batterName);

      avatar.textContent = initials;
      avatar.style.backgroundImage = '';
      avatar.style.background = 'radial-gradient(circle at 30% 30%, #ff6b95 0%, #ff2e68 50%, #b40036 100%)';
      avatar.style.backgroundSize = '';
      avatar.style.backgroundPosition = '';
      avatar.style.color = '#fff';

      if (!photoUrl) return;

      const probe = new Image();
      probe.onload = () => {
        avatar.textContent = '';
        avatar.style.background = '';
        avatar.style.backgroundImage = `url("${photoUrl}")`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
      };
      probe.onerror = () => {
        // Keep initials fallback if remote image URL fails.
      };
      probe.src = photoUrl;
    }

    function showBatterSpotlight(currentScore) {
      if (!currentScore.bat1) return;

      const container = document.getElementById('batter-spotlight');
      const p2Card = document.getElementById('spotlight-player-2');

      document.getElementById('spotlight-p1-name').textContent = currentScore.bat1;
      document.getElementById('spotlight-p1-score').textContent = formatBatterScore(currentScore.bat1r, currentScore.bat1b);
      setSpotlightAvatar('spotlight-p1-avatar', currentScore.bat1, currentScore.bat1Photo);
      document.getElementById('spotlight-p1-strike').style.display = 'inline-flex';
      document.getElementById('spotlight-p2-strike').style.display = 'none';

      if (currentScore.bat2) {
        p2Card.style.display = 'flex';
        document.getElementById('spotlight-p2-name').textContent = currentScore.bat2;
        document.getElementById('spotlight-p2-score').textContent = formatBatterScore(currentScore.bat2r, currentScore.bat2b);
        setSpotlightAvatar('spotlight-p2-avatar', currentScore.bat2, currentScore.bat2Photo);
      } else {
        p2Card.style.display = 'none';
      }

      document.getElementById('spotlight-context').textContent = getInningsContext(currentScore);
      document.getElementById('spotlight-partnership').textContent = getPartnershipText(currentScore);

      clearTimeout(spotlightTimeout);

      if (isSpotlightPinned) {
        container.classList.remove('show');
        container.classList.add('pinned');
      } else {
        container.classList.remove('pinned');
        container.classList.remove('show');
        void container.offsetWidth;
        container.classList.add('show');
        spotlightTimeout = setTimeout(() => {
          container.classList.remove('show');
        }, 6000);
      }
    }

    function checkOverCompletionAndShowBatters(currentScore) {
      const currentThisOverLength = Array.isArray(currentScore.thisOver)
        ? currentScore.thisOver.length
        : 0;

      if (prevThisOverLength >= 5 && currentThisOverLength <= 1) {
        showBatterSpotlight(currentScore);
      }

      prevThisOverLength = currentThisOverLength;
    }

    // Fetch score data
    async function fetchScore() {
      try {
        const response = await fetch('/score');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Failed to fetch score:', error);
        throw error;
      }
    }

    // Show fullcard every 2 overs
    function checkAndShowFullcard(currentScore) {
      if (!currentScore.overs1) return;

      const [overs, balls] = currentScore.overs1.toString().split('.').map(Number);
      const currentOverCount = overs || 0;

      // Trigger on every 2-over completion
      if (currentOverCount > 0 && currentOverCount % 2 === 0 && currentOverCount !== prevOverCount) {
        showFullcard(currentScore);
        prevOverCount = currentOverCount;
      }
    }

    function showFullcard(score) {
      clearTimeout(fullcardTimeout);

      // Update fullcard with score data
      document.getElementById('fullcard-team1').textContent = score.team1 || 'Team 1';
      document.getElementById('fullcard-score1').textContent = score.score1 || '-';
      document.getElementById('fullcard-wkts1').textContent = score.wkts1 || '-';
      document.getElementById('fullcard-overs1').textContent = score.overs1 || '-';
      document.getElementById('fullcard-crr1').textContent = formatRate(score.crr);

      document.getElementById('fullcard-team2').textContent = score.team2 || 'Team 2';
      document.getElementById('fullcard-score2').textContent = score.score2 || '-';
      document.getElementById('fullcard-wkts2').textContent = score.wkts2 || '-';
      document.getElementById('fullcard-overs2').textContent = score.overs2 || '-';
      document.getElementById('fullcard-crr2').textContent = formatRate(score.rrr);

      // Show fullcard
      const container = document.getElementById('fullcard-container');
      container.classList.add('show');

      // Hide after 8 seconds
      fullcardTimeout = setTimeout(() => {
        container.classList.remove('show');
      }, 8000);
    }

    // Detect duck (batsman out for 0)
    function checkDuck(currentScore) {
      if (!prevState.bat1r && currentScore.bat1r === 0 && currentScore.bat1 && prevState.bat1 !== currentScore.bat1) {
        showDuck();
      }
    }

    function showDuck() {
      const container = document.getElementById('duck-container');
      container.style.display = 'block';
      container.style.animation = 'none';
      // Trigger reflow to restart animation
      setTimeout(() => {
        container.style.animation = 'duckWalkIn 2s ease-out forwards';
      }, 10);
      setTimeout(() => {
        container.style.display = 'none';
      }, 2000);
    }

    // Detect boundary (4 or 6)
    function checkBoundary(currentScore) {
      const prevRuns = prevState.bat1r || 0;
      const currentRuns = currentScore.bat1r || 0;
      const ballDiff = (currentScore.bat1b || 0) - (prevState.bat1b || 0);

      if (ballDiff === 1 && (currentRuns - prevRuns === 4 || currentRuns - prevRuns === 6)) {
        const runDiff = currentRuns - prevRuns;
        showBoundary(runDiff === 6);
      }
    }

    function showBoundary(isSix) {
      const container = document.getElementById('boundary-container');
      document.querySelector('.boundary-text').textContent = isSix ? '🔥 SIX! 🔥' : '🔥 FOUR! 🔥';
      container.style.display = 'block';
      container.style.animation = 'none';
      setTimeout(() => {
        container.style.animation = 'boundaryBurst 2.5s ease-out forwards';
      }, 10);
      setTimeout(() => {
        container.style.display = 'none';
      }, 2500);

      createFireworks();
    }

    // Detect wicket
    function checkWicket(currentScore) {
      const prevWkts = Number(prevState.wkts1) || 0;
      const currentWkts = Number(currentScore.wkts1) || 0;

      if (currentWkts > prevWkts) {
        showWicket();
      }
    }

    function showWicket() {
      const container = document.getElementById('wicket-container');
      container.style.display = 'block';
      container.style.animation = 'none';
      setTimeout(() => {
        container.style.animation = 'wicketPop 3s ease-out forwards';
      }, 10);
      setTimeout(() => {
        container.style.display = 'none';
      }, 3000);
    }

    // Create fireworks effect
    function createFireworks() {
      const container = document.getElementById('fireworks-container');
      container.innerHTML = '';
      container.style.display = 'block';

      const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BA6'];
      const particleCount = 30;

      for (let i = 0; i < particleCount; i++) {
        const firework = document.createElement('div');
        firework.className = 'firework';
        firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        firework.style.left = '50%';
        firework.style.top = '50%';
        container.appendChild(firework);

        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 3 + Math.random() * 8;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        animateFirework(firework, vx, vy);
      }

      setTimeout(() => {
        container.style.display = 'none';
      }, 2000);
    }

    function animateFirework(element, vx, vy) {
      let x = 0;
      let y = 0;
      let gravity = 0.15;
      let duration = 1500;
      let startTime = Date.now();

      function update() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) return;

        x += vx;
        y += vy;
        vy += gravity;

        element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        element.style.opacity = 1 - elapsed / duration;

        requestAnimationFrame(update);
      }

      update();
    }

    // Main update loop
    async function updateOverlay() {
      const currentScore = await fetchScore();
      if (!currentScore) return;

      if (!hasBaselineState) {
        prevState = JSON.parse(JSON.stringify(currentScore));
        prevThisOverLength = Array.isArray(currentScore.thisOver) ? currentScore.thisOver.length : 0;
        updatePartnershipState(currentScore);
        hasBaselineState = true;
        if (isSpotlightPinned) {
          showBatterSpotlight(currentScore);
        }
        return;
      }

      updatePartnershipState(currentScore);

      // Check events
      checkAndShowFullcard(currentScore);
      checkDuck(currentScore);
      checkBoundary(currentScore);
      checkWicket(currentScore);
      checkOverCompletionAndShowBatters(currentScore);
      if (isSpotlightPinned) {
        showBatterSpotlight(currentScore);
      }

      // Update state
      prevState = JSON.parse(JSON.stringify(currentScore));
    }

    function runSpotlightDemo() {
      showBatterSpotlight({
        bat1: 'Virat Kohli',
        bat1r: '57',
        bat1b: '34',
        bat2: 'Rohit Sharma',
        bat2r: '41',
        bat2b: '28'
      });
    }

    // Poll for updates every 5 seconds
    setInterval(updateOverlay, 5000);
    updateOverlay();

    if (isSpotlightDemoMode) {
      setTimeout(runSpotlightDemo, 1200);
    }
