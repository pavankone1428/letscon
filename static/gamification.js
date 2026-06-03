// ─── GAMIFICATION & FUN FEATURES ───

// Achievement System
const ACHIEVEMENTS = {
    FIRST_POST: { id: 'first_post', name: 'First Post!', desc: 'Created your first post', icon: '📝', xp: 10 },
    FIRST_CONNECTION: { id: 'first_connection', name: 'Networker', desc: 'Made your first connection', icon: '🤝', xp: 15 },
    HELPFUL: { id: 'helpful', name: 'Helpful!', desc: 'Received 10 upvotes', icon: '⭐', xp: 25 },
    POPULAR: { id: 'popular', name: 'Popular!', desc: 'Got 50 upvotes', icon: '🔥', xp: 50 },
    SUPER_STAR: { id: 'super_star', name: 'Super Star', desc: 'Got 100 upvotes', icon: '🌟', xp: 100 },
    SOCIAL_BUTTERFLY: { id: 'social_butterfly', name: 'Social Butterfly', desc: '10 connections', icon: '🦋', xp: 30 },
    REFERRAL_KING: { id: 'referral_king', name: 'Referral King', desc: 'Helped 5 people with referrals', icon: '👑', xp: 75 },
    EARLY_BIRD: { id: 'early_bird', name: 'Early Bird', desc: 'Logged in before 6 AM', icon: '🌅', xp: 20 },
    NIGHT_OWL: { id: 'night_owl', name: 'Night Owl', desc: 'Active after midnight', icon: '🦉', xp: 20 },
    WEEK_STREAK: { id: 'week_streak', name: '7-Day Streak', desc: 'Active for 7 days straight', icon: '🔥', xp: 50 },
    STORYTELLER: { id: 'storyteller', name: 'Storyteller', desc: 'Posted 10 stories', icon: '📖', xp: 30 }
};

// User Level System
let userXP = parseInt(localStorage.getItem('userXP')) || 0;
let userLevel = calculateLevel(userXP);
let unlockedAchievements = JSON.parse(localStorage.getItem('achievements')) || [];

function calculateLevel(xp) {
    return Math.floor(xp / 100) + 1;
}

function getXPForNextLevel(level) {
    return level * 100;
}

function addXP(amount, reason) {
    const oldLevel = userLevel;
    userXP += amount;
    userLevel = calculateLevel(userXP);
    localStorage.setItem('userXP', userXP);
    
    // Show XP gain toast
    showXPToast(amount, reason);
    
    // Check for level up
    if (userLevel > oldLevel) {
        showLevelUpAnimation();
        createConfetti();
    }
    
    updateLevelDisplay();
}

function unlockAchievement(achievementId) {
    if (unlockedAchievements.includes(achievementId)) return;
    
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return;
    
    unlockedAchievements.push(achievementId);
    localStorage.setItem('achievements', JSON.stringify(unlockedAchievements));
    
    // Show achievement toast
    showAchievementToast(achievement);
    addXP(achievement.xp, achievement.name);
    createConfetti();
}

function showAchievementToast(achievement) {
    const existing = document.querySelector('.achievement-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-content">
            <div class="achievement-title">Achievement Unlocked!</div>
            <div class="achievement-desc">${achievement.name} - ${achievement.desc}</div>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
    
    playAchievementSound();
}

function showXPToast(amount, reason) {
    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#fbbf24,#f59e0b);color:white;padding:0.75rem 1.5rem;border-radius:2rem;box-shadow:0 4px 12px rgba(251,191,36,0.4);font-weight:700;z-index:10000;animation:xpPop 2s ease forwards;';
    toast.textContent = `+${amount} XP ${reason ? '• ' + reason : ''}`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
}

function showLevelUpAnimation() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;';
    overlay.innerHTML = `
        <div style="text-align:center;color:white;animation:levelUpScale 0.5s ease;">
            <div style="font-size:5rem;margin-bottom:1rem;">🎉</div>
            <div style="font-size:3rem;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem;">LEVEL UP!</div>
            <div style="font-size:1.5rem;opacity:0.9;">You are now Level ${userLevel}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    playLevelUpSound();
    createFireworks();
    
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s';
        setTimeout(() => overlay.remove(), 500);
    }, 3000);
}

function updateLevelDisplay() {
    const levelCard = document.querySelector('.level-card');
    if (levelCard) {
        const currentXP = userXP % 100;
        const percentage = currentXP;
        
        levelCard.querySelector('.level-number').textContent = `Level ${userLevel}`;
        levelCard.querySelector('.level-xp').textContent = `${currentXP} / 100 XP`;
        levelCard.querySelector('.level-progress-fill').style.width = `${percentage}%`;
    }
}

// Confetti Effect
function createConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.animationDelay = (Math.random() * 0.5) + 's';
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
    }
}

function createFireworks() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const particles = [];
    
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            life: 100
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
            
            if (p.life <= 0) particles.splice(i, 1);
            
            ctx.globalAlpha = p.life / 100;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        if (particles.length > 0) requestAnimationFrame(animate);
        else canvas.remove();
    }
    animate();
}

// Sound Effects
function playAchievementSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZSA0PVqzn77BeGAg+luL0xHElBSl+zPLaizsIGGS56OihUBELTKXh8bllHAU2jdXyz3osBSV6yu/dkUAKFF2z6OynVRQJRZ7f87hiIQYwiM/z1YU1Bhxrvu7mnEgND1Wr5u+zYBgIPJTg88NwJgUpfcvx2Ys6CBhiuOjno1IRCkyk4PK5Zh0FNIvU8s98LAYke8rv3pFACRZbtOftqVYUCUSc3/O3YSIGLoXN89eGNgYba77u55xIDQ5Uq+Xvs2EYBzuU4PPDcSYGKX7M8dqLOwgZYrnn6aRTEglMpODxuWcdBTSL1PLP ' + 'fSwGJHvK79+RQAoWW7Tn7alWFAhEnN7yt2EiBi6Fzu/YhjYGHGu97OibSQwNVKvl77NhGAc7lODzw3EmByl/zPHajDoIGGK55+mlUxIJTKTg8bhfHgUzie/yz3wsBCd5ye7ekj0LFlyy5O6pVRQIRJzd8bdhIQYthc/x14Y1BiJrv+7om0kMDFWs5u+yYBkHO5Xg9MNwJQYqgMzx24s5CBpjueXoqlMRCU2l4fO3Xx4FNIzU8dF8KwUlfMnv35I9CxZctOTtp1UUCESY3fG2YCEGLYbO8diFNgYhasDt55lIDAhWrOXvsmAZBzuV4fTCbyUFKoHM8duKOAkaZLrl6KpSEQhOpd/ytWAdBjSN1PHReysFJn3J8N+SPQsWXbPk7KdVEwdFmdzt1oQxBi2Izq7mgkMNFGW24OupUxIJTqXg8rVgHwYzjtHxz3wrBSh8yfDfkDwLF1604+ymVRMHRZnc7daFMQYtiM6v54JDDRRltuDrq1MSCk6l4PK1YR8GM47R8c98KwYofMrw35A8CxddtOPsplUUB0SZ3PvWhTEGLYjOr+eCQw0UZbbh66lTEwpNpeHxtWAdBTOO0fHPeyoGKHzK8d6QPAsWXbXj7KdVFAdFmdzq1oQxBy2IzK7ngkMOE2W04OqrUxIKTqTg8bVgHgYyj9Hxz3wrBih8yvHegjwMFl224+ymVRMHRZnc69aEMQYuiM2u54JDDhNltuDqq1MSCk6k4PG1YB4GMpDR8c97KgYofcrx3oI8DBVdteXsp1YUB0SZ3OrWhDEGLojNreeCQw4TZbXg6qtTEwpOpODxtWAeBjKP0fHPeioGKHzK8t+CPAwVXbXl7KdWFAdEmdzr1oQxBi6Iza3ngkMOE2W14OqrVBMKTqTg8rVfHwYxj9HxznsrBSh9yvHegzwMFV215eynVhMHRJnb69aFMQYuiM2t6IJDDhJlteHqq1MTCk6k3/K1Xx8GMY/R8s57KgUofc3x3oM8DBZdt+bsp1UTCESa2+vVhDEHLojNr+eCQw4TZbbg6qtTEgpPo+DxtWAeBjGP0fLPeioGKH3N8d6DPAsWXbfm7KdWEwdEmtvq1YQxBy6Iw==');
    audio.volume = 0.3;
    audio.play().catch(() => {});
}

function playLevelUpSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    audio.volume = 0.5;
    audio.play().catch(() => {});
}

// Streak Tracking
function checkStreak() {
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem('lastVisit');
    const streakCount = parseInt(localStorage.getItem('streakCount')) || 0;
    
    if (lastVisit !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastVisit === yesterday) {
            const newStreak = streakCount + 1;
            localStorage.setItem('streakCount', newStreak);
            if (newStreak === 7) unlockAchievement('WEEK_STREAK');
            addXP(5, 'Daily Login');
        } else {
            localStorage.setItem('streakCount', 1);
        }
        localStorage.setItem('lastVisit', today);
    }
    
    // Check time-based achievements
    const hour = new Date().getHours();
    if (hour < 6) unlockAchievement('EARLY_BIRD');
    if (hour >= 0 && hour < 3) unlockAchievement('NIGHT_OWL');
}

// Easter Eggs
function initEasterEggs() {
    let konamiCode = '';
    const konamiSequence = 'ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightba';
    
    document.addEventListener('keydown', (e) => {
        konamiCode += e.key;
        if (konamiCode.length > konamiSequence.length) {
            konamiCode = konamiCode.slice(-konamiSequence.length);
        }
        if (konamiCode === konamiSequence) {
            activateSecretMode();
        }
    });
    
    // Triple click logo
    let logoClicks = 0;
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', () => {
            logoClicks++;
            if (logoClicks === 3) {
                showSecretMessage();
                logoClicks = 0;
            }
            setTimeout(() => logoClicks = 0, 1000);
        });
    }
}

function activateSecretMode() {
    document.body.style.animation = 'rainbow 3s linear infinite';
    const style = document.createElement('style');
    style.textContent = '@keyframes rainbow { 0% { filter:hue-rotate(0deg); } 100% { filter:hue-rotate(360deg); } }';
    document.head.appendChild(style);
    
    setTimeout(() => {
        document.body.style.animation = '';
        style.remove();
    }, 10000);
    
    showToast('🌈 SECRET MODE ACTIVATED! 🌈');
    addXP(50, 'Found Secret!');
}

function showSecretMessage() {
    const messages = [
        '🎉 You found a secret!',
        '🚀 Keep exploring!',
        '⭐ You are awesome!',
        '🎯 Achievement Hunter!',
        '💎 Hidden gem found!'
    ];
    showToast(messages[Math.floor(Math.random() * messages.length)]);
    addXP(10, 'Curious Explorer');
}

// Toast Notification
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:white;padding:1rem 1.5rem;border-radius:2rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;animation:slideUp 0.3s ease;';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Interactive Animations
function addInteractiveAnimations() {
    // Particle effect on button clicks
    document.addEventListener('click', (e) => {
        if (e.target.closest('button')) {
            createClickParticles(e.clientX, e.clientY);
        }
    });
}

function createClickParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `position:fixed;width:6px;height:6px;background:#7c3aed;border-radius:50%;pointer-events:none;z-index:9999;left:${x}px;top:${y}px;`;
        document.body.appendChild(particle);
        
        const angle = (Math.PI * 2 * i) / 8;
        const velocity = 2;
        let vx = Math.cos(angle) * velocity;
        let vy = Math.sin(angle) * velocity;
        let posX = x;
        let posY = y;
        let life = 30;
        
        function animate() {
            life--;
            if (life <= 0) {
                particle.remove();
                return;
            }
            posX += vx;
            posY += vy;
            vy += 0.2;
            particle.style.left = posX + 'px';
            particle.style.top = posY + 'px';
            particle.style.opacity = life / 30;
            requestAnimationFrame(animate);
        }
        animate();
    }
}

// CSS Animation Styles
const animStyles = document.createElement('style');
animStyles.textContent = `
    @keyframes xpPop {
        0% { opacity:0; transform:translate(-50%, 20px) scale(0.8); }
        10% { opacity:1; transform:translate(-50%, 0) scale(1.1); }
        90% { opacity:1; transform:translate(-50%, 0) scale(1); }
        100% { opacity:0; transform:translate(-50%, -20px) scale(0.8); }
    }
    @keyframes levelUpScale {
        0% { transform:scale(0); }
        50% { transform:scale(1.1); }
        100% { transform:scale(1); }
    }
    @keyframes fadeOut {
        to { opacity:0; transform:translateX(-50%) translateY(10px); }
    }
`;
document.head.appendChild(animStyles);

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    checkStreak();
    updateLevelDisplay();
    initEasterEggs();
    addInteractiveAnimations();
});

// Export functions for use in main app
window.gamification = {
    addXP,
    unlockAchievement,
    showToast,
    createConfetti,
    ACHIEVEMENTS
};
