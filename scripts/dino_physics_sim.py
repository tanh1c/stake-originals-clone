"""
Dino Game Jump Physics Simulator v2
====================================
Key finding from v1: Large cactuses have only 4px clearance at peak!
The jump distance MUST be per-obstacle, not generic.

This version outputs a per-obstacle-type lookup table.
"""

FPS = 60
DT = 1.0 / FPS

# Player physics
GRAVITY_Y = 5000
ACCELERATION_Y = 3200
TOTAL_ACCEL = GRAVITY_Y + ACCELERATION_Y  # 8200
JUMP_VEL_START = -1350
MAX_VELOCITY = 1500

# Player sprite
PLAYER_SPRITE_W = 88
PLAYER_SPRITE_H = 94
PLAYER_X = 50
PLAYER_Y = 325

# Player body (running frame)
PLAYER_BODY_OFFSET_X = 25
PLAYER_BODY_OFFSET_Y = 4
PLAYER_BODY_W = 48  # 88-15-25
PLAYER_BODY_H = 90  # 94-4

# Obstacles
OBSTACLES = {
    "cactus-small-1": {"w": 34,  "h": 70,  "y": 327},
    "cactus-small-2": {"w": 68,  "h": 70,  "y": 327},
    "cactus-small-3": {"w": 102, "h": 70,  "y": 327},
    "cactus-large-1": {"w": 50,  "h": 100, "y": 327},
    "cactus-large-2": {"w": 100, "h": 100, "y": 327},
    "cactus-large-3": {"w": 150, "h": 100, "y": 327},
}
CACTUS_BORDER = 2

SPEEDS = list(range(6, 22, 2))


def simulate_jump(max_frames=60):
    y = PLAYER_Y
    vy = JUMP_VEL_START
    trajectory = [(0, y, vy)]
    for f in range(1, max_frames + 1):
        vy += TOTAL_ACCEL * DT
        vy = max(-MAX_VELOCITY, min(MAX_VELOCITY, vy))
        y += vy * DT
        if y >= PLAYER_Y and f > 1:
            y = PLAYER_Y
            trajectory.append((f, y, 0))
            break
        trajectory.append((f, y, vy))
    return trajectory


def get_player_body(player_y):
    sprite_top = player_y - PLAYER_SPRITE_H
    body_left = PLAYER_X + PLAYER_BODY_OFFSET_X
    body_right = body_left + PLAYER_BODY_W
    body_top = sprite_top + PLAYER_BODY_OFFSET_Y
    body_bottom = body_top + PLAYER_BODY_H
    return body_left, body_right, body_top, body_bottom


def get_obstacle_body(obs_type, obs_x):
    obs = OBSTACLES[obs_type]
    w, h, y = obs["w"], obs["h"], obs["y"]
    body_left = obs_x + CACTUS_BORDER
    body_right = obs_x + w - CACTUS_BORDER
    body_top = (y - h) + CACTUS_BORDER
    body_bottom = y - CACTUS_BORDER
    return body_left, body_right, body_top, body_bottom


def check_collision(player_y, obs_type, obs_x):
    p_left, p_right, p_top, p_bottom = get_player_body(player_y)
    o_left, o_right, o_top, o_bottom = get_obstacle_body(obs_type, obs_x)
    if p_right <= o_left or p_left >= o_right:
        return False
    if p_bottom <= o_top or p_top >= o_bottom:
        return False
    return True


def simulate_jump_over(speed, obs_type, jump_distance):
    trajectory = simulate_jump()
    player_right_edge = PLAYER_X + PLAYER_SPRITE_W
    pause_distance = jump_distance + 80
    obs_x = player_right_edge + pause_distance

    jump_triggered = False
    jump_frame_idx = 0
    min_clearance = 999

    for sim_frame in range(300):
        obs_x -= speed
        dist = obs_x - player_right_edge

        if not jump_triggered and dist <= jump_distance:
            jump_triggered = True
            jump_frame_idx = 0

        if jump_triggered and jump_frame_idx < len(trajectory):
            _, player_y, _ = trajectory[jump_frame_idx]
            jump_frame_idx += 1
        else:
            player_y = PLAYER_Y

        if check_collision(player_y, obs_type, obs_x):
            return False, sim_frame, min_clearance

        p_left, p_right, p_top, p_bottom = get_player_body(player_y)
        o_left, o_right, o_top, o_bottom = get_obstacle_body(obs_type, obs_x)

        if o_right > p_left and o_left < p_right:
            clearance = o_top - p_bottom
            min_clearance = min(min_clearance, clearance)

        if obs_x + OBSTACLES[obs_type]["w"] < PLAYER_X:
            return True, None, min_clearance

    return True, None, min_clearance


def find_safe_range(speed, obs_type):
    min_safe = None
    max_safe = None
    best_dist = None
    best_clearance = -999

    for dist in range(1, 500):
        cleared, _, clearance = simulate_jump_over(speed, obs_type, dist)
        if cleared:
            if min_safe is None:
                min_safe = dist
            max_safe = dist
            if clearance > best_clearance:
                best_clearance = clearance
                best_dist = dist

    return min_safe, max_safe, best_dist, best_clearance


if __name__ == "__main__":
    print("=" * 80)
    print("DINO GAME JUMP PHYSICS - v2 PER-OBSTACLE LOOKUP")
    print("=" * 80)

    # 1. Trajectory info
    traj = simulate_jump()
    peak_frame = max(range(len(traj)), key=lambda i: PLAYER_Y - traj[i][1])
    peak_height = PLAYER_Y - traj[peak_frame][1]
    print("\nJump: {} frames, peak at frame {} ({:.0f}px height)".format(
        len(traj) - 1, peak_frame, peak_height))

    # 2. Max clearance for each obstacle type
    print("\nObstacle clearances at peak:")
    _, _, _, p_bottom_peak = get_player_body(traj[peak_frame][1])
    for name, data in OBSTACLES.items():
        _, _, o_top, _ = get_obstacle_body(name, PLAYER_X)
        cl = o_top - p_bottom_peak
        print("  {}: height={}px, clearance={:.0f}px {}".format(
            name, data["h"], cl, "[OK]" if cl > 0 else "[IMPOSSIBLE]"))

    # 3. Per-speed per-obstacle safe ranges
    print("\n" + "=" * 80)
    print("PER-OBSTACLE SAFE JUMP DISTANCES")
    print("=" * 80)

    # Collect all data
    all_results = {}
    for speed in SPEEDS:
        all_results[speed] = {}
        for obs_name in OBSTACLES:
            mn, mx, best, cl = find_safe_range(speed, obs_name)
            all_results[speed][obs_name] = {
                "min": mn, "max": mx, "best": best, "clearance": cl
            }
            status = "range {}-{}".format(mn, mx) if mn else "IMPOSSIBLE"
            best_str = "best={}".format(best) if best else "-"
            cl_str = "{:.1f}px".format(cl) if cl > -900 else "-"
            print("  speed={:>2} | {:<18} | {} | {} | cl={}".format(
                speed, obs_name, status, best_str, cl_str))

    # 4. For actual game: use per-obstacle lookup keyed by width+height
    print("\n" + "=" * 80)
    print("JAVASCRIPT IMPLEMENTATION")
    print("=" * 80)

    # Group by obstacle height since that determines clearance
    print("\n// Optimal jump distances per speed, grouped by obstacle height")
    print("// key = speed (rounded to nearest even), value = jump distance")

    for obs_height in [70, 100]:
        height_label = "small" if obs_height == 70 else "large"
        print("\n// --- {} cactus (height={}) ---".format(height_label, obs_height))

        # Find widest obstacle of this height (worst case)
        worst_obs = None
        worst_width = 0
        for name, data in OBSTACLES.items():
            if data["h"] == obs_height and data["w"] > worst_width:
                worst_width = data["w"]
                worst_obs = name

        print("// Worst case: {} (width={})".format(worst_obs, worst_width))

        lookup = {}
        for speed in SPEEDS:
            r = all_results[speed][worst_obs]
            if r["best"]:
                lookup[speed] = r["best"]
            else:
                lookup[speed] = None

        print("const JUMP_DIST_{} = {{".format(height_label.upper()))
        for speed in SPEEDS:
            val = lookup.get(speed)
            if val:
                print("  {}: {},".format(speed, val))
            else:
                print("  {}: null, // CANNOT CLEAR at this speed".format(speed))
        print("};")

    # 5. Combined approach: use obstacle.displayHeight to determine
    print("\n// Combined function for GameScene.js:")
    print("// Uses obstacle dimensions to pick the right lookup")
    print("")
    print("static JUMP_LOOKUP = {")

    # Build unified lookup: speed -> {small_dist, large_dist}
    for speed in SPEEDS:
        small_worst = "cactus-small-3"
        large_worst = "cactus-large-3"
        s_r = all_results[speed][small_worst]
        l_r = all_results[speed][large_worst]
        s_val = s_r["best"] if s_r["best"] else "null"
        l_val = l_r["best"] if l_r["best"] else "null"
        print("  {}: {{ small: {}, large: {} }},".format(speed, s_val, l_val))

    print("};")

    print("""
calculateOptimalJumpDistance(speed, obstacle) {
  const lookup = GameScene.JUMP_LOOKUP;
  const isLarge = obstacle.displayHeight > 80; // 70 = small, 100 = large
  
  // Find nearest speed in lookup
  const speeds = Object.keys(lookup).map(Number).sort((a,b) => a-b);
  let nearest = speeds[0];
  for (const s of speeds) {
    if (Math.abs(s - speed) < Math.abs(nearest - speed)) nearest = s;
  }
  
  const entry = lookup[nearest];
  let dist = isLarge ? entry.large : entry.small;
  
  // If the obstacle can't be cleared at this speed, use the small value
  // (the processCallback safety net will handle edge cases)
  if (dist === null) dist = entry.small || 60;
  
  return dist;
}""")

    # 6. Verification
    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)

    for speed in SPEEDS:
        for obs_name in OBSTACLES:
            r = all_results[speed][obs_name]
            if r["best"]:
                cleared, cf, cl = simulate_jump_over(speed, obs_name, r["best"])
                status = "[OK]" if cleared else "[FAIL@{}]".format(cf)
                print("  speed={:>2} {} {:18s} dist={:>3} cl={:.1f}px".format(
                    speed, status, obs_name, r["best"], cl))
            else:
                print("  speed={:>2} [SKIP] {:18s} (impossible)".format(speed, obs_name))
