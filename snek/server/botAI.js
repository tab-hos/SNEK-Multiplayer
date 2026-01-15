// Bot AI for automatic gameplay
// Simple AI that tries to avoid collisions and get food

// Calculate Manhattan distance with wrapping
function calculateDistance(pos1, pos2, gridSize) {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  const wrapDx = Math.min(dx, gridSize - dx);
  const wrapDy = Math.min(dy, gridSize - dy);
  return wrapDx + wrapDy;
}

// Find closest target (food or powerup)
function findClosestTarget(head, targets, gridSize) {
  if (!targets || targets.length === 0) return null;
  
  let closest = null;
  let minDistance = Infinity;
  
  targets.forEach(target => {
    const distance = calculateDistance(head, target, gridSize);
    if (distance < minDistance) {
      minDistance = distance;
      closest = target;
    }
  });
  
  return closest;
}

export function calculateBotDirection(player, room) {
  const head = player.snake[0];
  const gridSize = room.grid_size ?? 30;
  
  // Handle food as array
  const foodArray = Array.isArray(room.food) ? room.food : (room.food ? [room.food] : []);
  
  // Handle powerups as array
  const powerupsArray = Array.isArray(room.powerups) ? room.powerups : [];
  
  // Get all occupied positions (other snakes and self body)
  const allSegments = [];
  room.players.forEach((p, pIdx) => {
    if (p.alive && p.id !== player.id) {
      p.snake.forEach(seg => {
        allSegments.push({ x: seg.x, y: seg.y });
      });
    }
  });
  
  // Add self body (excluding head)
  player.snake.slice(1).forEach(seg => {
    allSegments.push({ x: seg.x, y: seg.y });
  });
  
  // Find closest food and powerup
  const closestFood = findClosestTarget(head, foodArray, gridSize);
  const closestPowerup = findClosestTarget(head, powerupsArray, gridSize);
  
  // Choose the closest target overall (food or powerup), but give slight preference to powerups if distances are similar
  let target = null;
  if (closestFood && closestPowerup) {
    const distToFood = calculateDistance(head, closestFood, gridSize);
    const distToPowerup = calculateDistance(head, closestPowerup, gridSize);
    // If powerup is within 2 cells of food distance, prefer powerup, otherwise prefer closest
    if (distToPowerup <= distToFood + 2) {
      target = closestPowerup;
    } else {
      target = closestFood;
    }
  } else {
    target = closestPowerup || closestFood;
  }
  
  // Possible directions
  const directions = [
    { x: 0, y: -1, name: 'up' },
    { x: 0, y: 1, name: 'down' },
    { x: -1, y: 0, name: 'left' },
    { x: 1, y: 0, name: 'right' }
  ];
  
  // Filter out opposite direction (can't reverse)
  const currentDir = player.direction || { x: 1, y: 0 };
  const validDirections = directions.filter(dir => {
    return !(dir.x === -currentDir.x && dir.y === -currentDir.y);
  });
  
  // Score each direction
  const scoredDirections = validDirections.map(dir => {
    const newHead = {
      x: (head.x + dir.x + gridSize) % gridSize,
      y: (head.y + dir.y + gridSize) % gridSize
    };
    
    let score = 0;
    
    // Check if this direction leads to collision
    const wouldCollide = allSegments.some(seg => 
      seg.x === newHead.x && seg.y === newHead.y
    );
    
    if (wouldCollide) {
      score -= 1000; // Heavy penalty for collisions
    }
    
    // Prefer moving towards closest target (food or powerup)
    if (target) {
      const distToTarget = calculateDistance(newHead, target, gridSize);
      const currentDist = calculateDistance(head, target, gridSize);
      const isPowerup = closestPowerup && target === closestPowerup;
      
      if (distToTarget < currentDist) {
        // Bonus for moving closer - powerups get slightly higher priority
        score += isPowerup ? 15 : 12;
      } else if (distToTarget > currentDist) {
        // Penalty for moving away
        score -= isPowerup ? 8 : 6;
      }
    }
    
    // Prefer current direction (less erratic movement)
    if (dir.x === currentDir.x && dir.y === currentDir.y) {
      score += 2;
    }
    
    // Avoid walls (prefer center) - but less important than targets
    const distFromCenterX = Math.abs(newHead.x - gridSize / 2);
    const distFromCenterY = Math.abs(newHead.y - gridSize / 2);
    const distFromCenter = distFromCenterX + distFromCenterY;
    score -= distFromCenter * 0.05; // Slight preference for center
    
    return { direction: dir, score };
  });
  
  // Sort by score (highest first)
  scoredDirections.sort((a, b) => b.score - a.score);
  
  // Return best direction, or current direction if all are bad
  const bestDirection = scoredDirections[0];
  if (bestDirection && bestDirection.score > -500) {
    return bestDirection.direction;
  }
  
  // If all directions are dangerous, try to find any safe direction
  const safeDirection = validDirections.find(dir => {
    const newHead = {
      x: (head.x + dir.x + gridSize) % gridSize,
      y: (head.y + dir.y + gridSize) % gridSize
    };
    return !allSegments.some(seg => seg.x === newHead.x && seg.y === newHead.y);
  });
  
  return safeDirection ? safeDirection.direction : currentDir; // Fallback to current direction
}

