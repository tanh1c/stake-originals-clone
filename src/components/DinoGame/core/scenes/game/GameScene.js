import Phaser from 'phaser';

import CONFIG from '../../config/game';
import InputManager from './InputManager';
import SoundManager from './SoundManager';
import ResizeManager from './ResizeManager';
import LocalScoreManager from './score/LocalScoreManager';
import TelegramScoreManager from './score/TelegramScoreManager';
import UI from './UI';
import Intro from './Intro';
import Player from '../../prefabs/player/Player';
import Horizon from '../../prefabs/horizon/Horizon';
import Cactus from '../../prefabs/horizon/obstacles/cactus/Cactus';
import isTelegramMode from '../../utils/telegram/isTelegramMode';

/**
 * Main game scene with betting mode.
 *
 * Jump distances verified by Python physics simulation (scripts/dino_physics_sim.py).
 *
 * Simulation results summary:
 *   Jump: 19 frames, peak at frame 9 (100px height above ground)
 *   Player body at peak: top=135, bottom=225
 *   Cactus-small body_top=259 → 34px clearance at peak  ✓
 *   Cactus-large body_top=229 → only 4px clearance at peak (barely possible)
 *
 * Per-obstacle optimal jump distances (px from player right edge to obstacle left edge):
 *   speed=10: small-1=33, small-2=13
 *   speed=12: small-1=59, small-2=35
 *   speed=14: small-1=71, small-2=57, small-3=43
 *   speed=16: small-1=95, small-2=79, small-3=47
 *   speed=18: small-1=119, small-2=101, small-3=83
 *   speed=20: small-1=123, small-2=103, small-3=83
 *   Large cactuses are NOT clearable at any realistic game speed (max=17).
 */
class GameScene extends Phaser.Scene {
  static CONFIG = CONFIG.SCENES.GAME;

  /**
   * Lookup table: per-speed optimal jump distance for each obstacle width category.
   * Generated from Python simulation. Key = speed (rounded), value = jump distance.
   * Uses obstacle width to determine category:
   *   narrow  (w <= 40):  cactus-small-1 (34px)
   *   medium  (w <= 75):  cactus-small-2 (68px)
   *   wide    (w <= 110): cactus-small-3 (102px)
   */
  static JUMP_DISTANCES = {
    // { speed: { narrow, medium, wide } }
    8: { narrow: 15, medium: null, wide: null },
    10: { narrow: 33, medium: 13, wide: null },
    12: { narrow: 59, medium: 35, wide: null },
    14: { narrow: 71, medium: 57, wide: 43 },
    16: { narrow: 95, medium: 79, wide: 47 },
    17: { narrow: 107, medium: 90, wide: 65 },  // interpolated (max speed)
    18: { narrow: 119, medium: 101, wide: 83 },
    20: { narrow: 123, medium: 103, wide: 83 },
  };

  constructor() {
    super(GameScene.CONFIG.NAME);
  }

  init() {
    this.isInitialStart = true;
    this.isPlaying = false;
    this.readyToRestart = false;

    // Betting mode state
    this.bettingMode = false;
    this.waitingForJump = false;
    this.obstaclesCleared = 0;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;
    this.optimalJumpDistance = 0;
    this.forceDarkMode = false;

    // Speed
    this.speed = 0;
    this.maxSpeed = 0;
    this.initSpeed();

    // Scoring
    this.distance = 0;
    this.highScore = 0;

    // Managers
    this.soundManager = new SoundManager(this);
    this.inputManager = new InputManager(this);
    this.resizeManager = new ResizeManager(this, {
      canvas: this.onResizeCanvas.bind(this),
      camera: this.onResizeCamera.bind(this),
      gameSpeed: this.onResizeGameSpeed.bind(this),
      gameObjects: this.onResizeGameObjects.bind(this),
    });
    this.scoreManager = isTelegramMode()
      ? new TelegramScoreManager(this.events)
      : new LocalScoreManager(this.events);

    // Events
    this.events.on(CONFIG.EVENTS.GAME_START, this.onGameStart, this);
    this.events.on(CONFIG.EVENTS.GAME_INTRO_START, this.onIntroStart, this);
    this.events.on(CONFIG.EVENTS.GAME_INTRO_COMPLETE, this.onIntroComplete, this);
    this.events.on(CONFIG.EVENTS.GAME_RESTART, this.onGameRestart, this);
    this.events.on(CONFIG.EVENTS.GAME_OVER, this.onGameOver, this);
    this.events.on(CONFIG.EVENTS.HIGH_SCORE_UPDATE, this.onHighScoreUpdate, this);

    // Betting events
    this.events.on(CONFIG.EVENTS.BETTING_MODE_ON, this.onBettingModeOn, this);
    this.events.on(CONFIG.EVENTS.BETTING_MODE_OFF, this.onBettingModeOff, this);
    this.events.on(CONFIG.EVENTS.JUMP_SUCCESS, this.onJumpSuccess, this);
    this.events.on(CONFIG.EVENTS.JUMP_FAIL, this.onJumpFail, this);

    this.events.on('FORCE_DARK_MODE', this.onForceDarkMode, this);
  }

  onForceDarkMode(isDark) {
    this.forceDarkMode = isDark;
    if (this.nightMode) {
      if (isDark && !this.nightMode.isEnabled) {
        this.nightMode.enable();
      } else if (!isDark && this.nightMode.isEnabled) {
        this.nightMode.disable();
      }
    }
  }

  initSpeed() {
    const { width } = this.scale.gameSize;
    const { INITIAL, MAX, MOBILE_COEFFICIENT } = GameScene.CONFIG.GAME.OBSTACLES.SPEED;

    if (width === CONFIG.GAME.WIDTH.LANDSCAPE) {
      this.speed = INITIAL;
      this.maxSpeed = MAX;
    } else if (width === CONFIG.GAME.WIDTH.PORTRAIT) {
      this.speed = INITIAL / MOBILE_COEFFICIENT;
      this.maxSpeed = MAX / MOBILE_COEFFICIENT;
    }
  }

  create() {
    this.ui = new UI(this);
    this.intro = new Intro(this.events);
    this.player = new Player(this);

    this.horizon = new Horizon(this);
    this.ground = this.horizon.ground;
    this.obstacles = this.horizon.obstacles;
    this.nightMode = this.horizon.nightMode;

    this.physics.add.collider(this.player, this.ground);

    // processCollision is a SAFETY NET: during a successful jump,
    // if the player is genuinely ABOVE the obstacle, ignore the overlap.
    this.physics.add.overlap(
      this.player,
      this.obstacles,
      this.onPlayerHitObstacle,
      this.processCollision,
      this
    );

    this.resizeManager.resize(this.scale.gameSize, this.scale.parentSize);

    this.scoreManager
      .getHighScore()
      .then(highScore => { this.highScore = highScore; })
      .catch(() => { });
  }

  /**
   * Collision filter callback.
   * During a successful jump sequence (shouldAutoJump or successfulJumpInProgress),
   * ALWAYS skip collision with the current obstacle.
   * The RNG already determined survival—the animation just needs to play out.
   * For FAIL cases, this returns true and collision fires normally.
   */
  processCollision(player, obstacle) {
    // During a SUCCESSFUL jump sequence, ignore collision with the target obstacle
    if (this.currentObstacle && obstacle === this.currentObstacle) {
      if (this.successfulJumpInProgress || this.shouldAutoJump) {
        return false; // RNG said survive → skip this collision
      }
    }
    return true; // All other collisions fire normally
  }

  update() {
    const { gameSize } = this.scale;
    const isMobile = gameSize.width === CONFIG.GAME.WIDTH.PORTRAIT;

    this.inputManager.update();
    this.ui.update(this.isPlaying, gameSize, this.score);

    if (this.isPlaying) {
      this.player.update();

      if (this.intro.isComplete) {
        const { GAME, NIGHTMODE } = GameScene.CONFIG;
        const { OBSTACLES } = GAME;

        // === BETTING: Detect incoming obstacle ===
        if (this.bettingMode && !this.waitingForJump &&
          !this.shouldAutoJump && !this.shouldFailJump &&
          !this.successfulJumpInProgress) {
          const nearestObstacle = this.getNearestObstacle();
          if (nearestObstacle) {
            const playerRight = this.player.x + this.player.width;
            const dist = nearestObstacle.x - playerRight;

            // Check if this obstacle is clearable
            const jumpDist = this.getJumpDistanceForObstacle(nearestObstacle);

            // Only pause if obstacle is clearable AND within pause distance
            if (jumpDist !== null) {
              const pauseDistance = Math.max(jumpDist + 100, 200);

              if (dist < pauseDistance && dist > 0) {
                this.waitingForJump = true;
                this.pausedSpeed = this.speed;
                this.speed = 0;
                this.currentObstacle = nearestObstacle;
                this.events.emit(CONFIG.EVENTS.WAITING_FOR_JUMP, this.obstaclesCleared);
                return;
              }
            }
            // If jumpDist is null (unclearable), just let it pass naturally
          }
        }

        // === WAITING for player decision ===
        if (this.waitingForJump) return;

        // === AUTO-JUMP: timing the jump for success ===
        if (this.shouldAutoJump && this.currentObstacle) {
          const playerRight = this.player.x + this.player.width;
          const dist = this.currentObstacle.x - playerRight;

          if (dist <= this.optimalJumpDistance) {
            this.player.jump();
            this.shouldAutoJump = false;
            this.successfulJumpInProgress = true;
            this.watchForObstacleClear();
          }
        }

        // === FAIL: no jump needed, dino just runs into the obstacle ===
        // shouldFailJump flag only prevents re-detection above.
        // processCollision returns true → physics collision → GAME_OVER.

        // === Normal speed update ===
        if (this.speed < this.maxSpeed) {
          this.speed += OBSTACLES.ACCELERATION;
        } else {
          this.speed = this.maxSpeed;
        }

        this.distance += this.speed;

        if (!this.forceDarkMode && this.shouldNightModeStart) {
          this.nightMode.enable();
          this.time.delayedCall(NIGHTMODE.DURATION, () => {
            if (this.isPlaying && this.nightMode.isEnabled && !this.forceDarkMode) {
              this.nightMode.disable();
            }
          });
        }

        this.horizon.update(this.speed, isMobile);
      }
    }
  }

  // =========================================================
  // JUMP DISTANCE CALCULATION (from Python simulation data)
  // =========================================================

  /**
   * Get the optimal jump distance for a specific obstacle based on its width
   * and the current game speed. Uses the pre-computed lookup table.
   *
   * @param {Phaser.Physics.Arcade.Sprite} obstacle
   * @returns {number|null} distance in px, or null if unclearable
   */
  getJumpDistanceForObstacle(obstacle) {
    const obsWidth = obstacle.displayWidth || obstacle.width;
    const obsHeight = obstacle.displayHeight || obstacle.height;

    // Large cactuses (height >= 90) are not clearable at game speeds <= 17
    if (obsHeight >= 90) return null;

    // Determine width category
    let category;
    if (obsWidth <= 40) {
      category = 'narrow';   // cactus-small-1 (34px wide)
    } else if (obsWidth <= 75) {
      category = 'medium';   // cactus-small-2 (68px wide)
    } else {
      category = 'wide';     // cactus-small-3 (102px wide)
    }

    // Find nearest speed in lookup
    const lookup = GameScene.JUMP_DISTANCES;
    const speeds = Object.keys(lookup).map(Number).sort((a, b) => a - b);
    const currentSpeed = Math.round(this.speed);

    let nearest = speeds[0];
    for (const s of speeds) {
      if (Math.abs(s - currentSpeed) < Math.abs(nearest - currentSpeed)) {
        nearest = s;
      }
    }

    const entry = lookup[nearest];
    if (!entry) return null;

    const dist = entry[category];
    return dist; // can be null if not clearable at this speed
  }

  /**
   * Watch for the current obstacle to pass the player after a successful jump.
   * IMPORTANT: Only clears state if currentObstacle is still the SAME obstacle,
   * to avoid overwriting a newer obstacle reference for the next jump.
   */
  watchForObstacleClear() {
    const trackedObstacle = this.currentObstacle;
    if (!trackedObstacle) {
      this.successfulJumpInProgress = false;
      return;
    }

    const checkCleared = this.time.addEvent({
      delay: 50,
      callback: () => {
        const playerX = this.player.x;
        if (!trackedObstacle.visible || trackedObstacle.x + trackedObstacle.width < playerX) {
          checkCleared.remove();
          this.obstaclesCleared++;
          this.successfulJumpInProgress = false;
          // Only null currentObstacle if it's STILL the one we tracked
          if (this.currentObstacle === trackedObstacle) {
            this.currentObstacle = null;
          }
        }
      },
      loop: true,
    });

    // Safety timeout - only clear if still tracking the same obstacle
    this.time.delayedCall(3000, () => {
      checkCleared.remove();
      this.successfulJumpInProgress = false;
      if (this.currentObstacle === trackedObstacle) {
        this.currentObstacle = null;
      }
    });
  }

  /**
   * Get the nearest visible obstacle in front of the player
   */
  getNearestObstacle() {
    let nearest = null;
    let minDist = Infinity;
    const playerX = this.player.x;

    this.obstacles.children.each(obstacle => {
      if (obstacle.visible && obstacle.x > playerX) {
        const dist = obstacle.x - playerX;
        if (dist < minDist) {
          minDist = dist;
          nearest = obstacle;
        }
      }
    });

    return nearest;
  }

  // =========================================================
  // BETTING MODE HANDLERS
  // =========================================================

  onBettingModeOn() {
    this.bettingMode = true;
    this.waitingForJump = false;
    this.obstaclesCleared = 0;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;

    if (this.player && this.player.inputManager) {
      this.player.inputManager.disabled = true;
    }

    // Override obstacle spawning to only spawn clearable obstacles
    this.overrideObstacleSpawning();
  }

  onBettingModeOff() {
    this.bettingMode = false;
    this.waitingForJump = false;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;

    if (this.player && this.player.inputManager) {
      this.player.inputManager.disabled = false;
    }

    // Restore original obstacle spawning
    this.restoreObstacleSpawning();
  }

  /**
   * Override obstacle spawning to only produce clearable obstacles (small cactuses).
   * Large cactuses are IMPOSSIBLE to jump over (only 4px clearance at peak).
   */
  overrideObstacleSpawning() {
    if (!this.obstacles) return;

    // Save original spawnItem method
    if (!this.obstacles._originalSpawnItem) {
      this.obstacles._originalSpawnItem = this.obstacles.spawnItem.bind(this.obstacles);
    }

    const scene = this;

    // Replace with betting-mode-only spawner
    this.obstacles.spawnItem = function (speed, isMobile) {
      const { CACTUS } = CONFIG.PREFABS.OBSTACLES;
      const { width } = scene.scale.gameSize;

      // Only spawn small cactuses in betting mode
      let maxSize = 1;
      if (speed >= 14) maxSize = 3;
      else if (speed >= 10) maxSize = 2;

      const size = Phaser.Math.RND.between(1, maxSize);
      const frame = `cactus-small-${size}`;

      const newObstacle = new Cactus(scene, width, CACTUS.POS.Y, frame);
      this.add(newObstacle);
      const gap = this.getGap(speed, CACTUS.GAP.MIN, newObstacle.width);
      newObstacle.setGap(gap);
    };
  }

  /**
   * Restore original obstacle spawning
   */
  restoreObstacleSpawning() {
    if (this.obstacles && this.obstacles._originalSpawnItem) {
      this.obstacles.spawnItem = this.obstacles._originalSpawnItem;
      delete this.obstacles._originalSpawnItem;
    }
  }

  /**
   * SUCCESS: Resume speed, calculate optimal jump point, set auto-jump.
   */
  onJumpSuccess() {
    if (!this.waitingForJump) return;

    this.waitingForJump = false;
    this.speed = this.pausedSpeed || 10;

    // Get verified optimal jump distance for THIS obstacle
    let jumpDist = 60; // safe default
    if (this.currentObstacle) {
      const calculated = this.getJumpDistanceForObstacle(this.currentObstacle);
      if (calculated !== null) jumpDist = calculated;
    }

    this.optimalJumpDistance = jumpDist;
    this.shouldAutoJump = true;
  }

  /**
   * FAIL: Resume speed, let the dino run into the obstacle naturally.
   * No jump needed — physics overlap will trigger GAME_OVER.
   * currentObstacle stays set so processCollision returns true (collision fires).
   */
  onJumpFail() {
    if (!this.waitingForJump) return;

    this.waitingForJump = false;
    this.speed = this.pausedSpeed || 10;
    this.shouldFailJump = true;
    // Keep currentObstacle set — processCollision will NOT block this collision
    // because shouldAutoJump and successfulJumpInProgress are both false.
  }

  // =========================================================
  // STANDARD GAME HANDLERS
  // =========================================================

  onPlayerHitObstacle() {
    this.events.emit(CONFIG.EVENTS.GAME_OVER, this.score, this.highScore);
  }

  onGameStart() {
    this.isPlaying = true;
    this.isInitialStart = false;
    this.ui.highScorePanel.setScore(this.highScore);
  }

  onIntroStart() {
    const { width } = this.scale.gameSize;
    this.tweens.add({
      targets: this.cameras.main,
      duration: GameScene.CONFIG.INTRO.DURATION,
      width,
    });
  }

  onIntroComplete() {
    const { canvas, gameSize, parentSize } = this.scale;
    const originalTransition = canvas.style.transition;
    const newTransition = `${CONFIG.SCENES.GAME.STYLES.TRANSITION}, ${originalTransition}`;
    canvas.style.transition = newTransition;
    this.resizeManager.resizeCanvas(gameSize, parentSize);
    canvas.addEventListener('transitionend', () => {
      canvas.style.transition = originalTransition;
      this.resizeManager.resizeCanvas(gameSize, parentSize);
    });
  }

  onGameRestart() {
    this.isPlaying = true;
    this.readyToRestart = false;
    this.distance = 0;
    this.speed = 0;
    this.maxSpeed = 0;
    this.initSpeed();

    // Reset betting state
    this.waitingForJump = false;
    this.obstaclesCleared = 0;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;

    this.physics.resume();

    this.scoreManager
      .getHighScore()
      .then(highScore => { this.highScore = highScore; })
      .catch(() => { });
  }

  onGameOver() {
    const { width: gameWidth, height: gameHeight } = this.scale.gameSize;
    this.isPlaying = false;
    this.physics.pause();
    this.scale.resize(gameWidth, gameHeight);

    if (this.game.device.features.vibration) {
      navigator.vibrate(GameScene.CONFIG.GAMEOVER.VIBRATION);
    }

    if (this.score > this.highScore) {
      this.events.emit(CONFIG.EVENTS.HIGH_SCORE_UPDATE, this.score);
    }
  }

  onHighScoreUpdate(highScore) {
    this.scoreManager
      .saveHighScore(highScore)
      .then(() => { this.highScore = highScore; })
      .catch(() => { });
  }

  get score() {
    return Math.ceil(this.distance * GameScene.CONFIG.GAME.SCORE.COEFFICIENT);
  }

  get shouldNightModeStart() {
    const { score, nightMode } = this;
    const { DISTANCE } = GameScene.CONFIG.NIGHTMODE;
    return score > 0 && score % DISTANCE === 0 && !nightMode.isEnabled;
  }

  // =========================================================
  // RESIZE
  // =========================================================

  onResizeCanvas(gameSize) {
    const { width, height } = gameSize;
    if (!this.intro.isComplete) {
      return { width: width * 0.8, height: height * 0.8 };
    }
    return { width, height };
  }

  onResizeGameSpeed(gameSize) {
    const { MAX, MOBILE_COEFFICIENT } = GameScene.CONFIG.GAME.OBSTACLES.SPEED;
    if (gameSize.width === CONFIG.GAME.WIDTH.LANDSCAPE) {
      this.speed *= MOBILE_COEFFICIENT;
      this.maxSpeed = MAX;
    } else if (gameSize.width === CONFIG.GAME.WIDTH.PORTRAIT) {
      this.speed /= MOBILE_COEFFICIENT;
      this.maxSpeed = MAX / MOBILE_COEFFICIENT;
    }
  }

  onResizeCamera(gameSize) {
    const { width, height } = gameSize;
    const { main: mainCamera } = this.cameras;
    mainCamera.setOrigin(0, 0.5);
    if (this.intro.isComplete) {
      mainCamera.setViewport(0, 0, width, height);
    } else {
      mainCamera.setViewport(0, 0, GameScene.CONFIG.INTRO.CAMERA.WIDTH, height);
    }
  }

  onResizeGameObjects(gameSize) {
    this.ui.resize(gameSize);
    this.ground.resize(gameSize);
  }
}

export default GameScene;
