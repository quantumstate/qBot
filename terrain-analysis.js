/*
 * TerrainAnalysis inherits from Map
 * 
 * This creates a suitable passability map for pathfinding units and provides the findClosestPassablePoint() function.
 * This is intended to be a base object for the terrain analysis modules to inherit from. 
 */ 

function TerrainAnalysis(gameState){
	var passabilityMap = gameState.getMap();

	var obstructionMask = gameState.getPassabilityClassMask("pathfinderObstruction");
	obstructionMask |= gameState.getPassabilityClassMask("default");
	
	var obstructionTiles = new Uint16Array(passabilityMap.data.length); 
	for (var i = 0; i < passabilityMap.data.length; ++i) 
	{ 
		obstructionTiles[i] = (passabilityMap.data[i] & obstructionMask) ? 0 : 65535; 
	}
	
	this.Map(gameState, obstructionTiles);
};

copyPrototype(TerrainAnalysis, Map);

// Returns the (approximately) closest point which is passable by searching in a spiral pattern 
TerrainAnalysis.prototype.findClosestPassablePoint = function(startPoint){
	var w = this.width;
	var p = startPoint;
	var direction = 1;
	
	if (p[0] + w*p[1] > 0 && p[0] + w*p[1] < this.length &&
			this.map[p[0] + w*p[1]] != 0){
		return p;
	}
	
	// search in a spiral pattern.
	for (var i = 1; i < w; i++){
		for (var j = 0; j < 2; j++){
			for (var k = 0; k < i; k++){
				p[j] += direction;
				if (p[0] + w*p[1] > 0 && p[0] + w*p[1] < this.length &&
						this.map[p[0] + w*p[1]] != 0){
					return p;
				}
			}
		}
		direction *= -1;
	}
	
	return undefined;
};

/*
 * PathFinder inherits from TerrainAnalysis
 *  
 * Used to create a list of distinct paths between two points. 
 * 
 * Currently a WIP.
 */


function PathFinder(gameState){
	this.TerrainAnalysis(gameState);
}

copyPrototype(PathFinder, TerrainAnalysis);

PathFinder.prototype.getPaths = function(start, end){
	var s = this.findClosestPassablePoint(this.gamePosToMapPos(start));
	var e = this.findClosestPassablePoint(this.gamePosToMapPos(end));
	
	if (!s || !e){
		return undefined;
	}
	
	this.makeGradient(s,e);
	
	this.walkGradient(e);
	
	this.dumpIm("terrainanalysis.png", 511);
	
	return "placeHolder";
};

PathFinder.prototype.makeGradient = function(start, end){
	var w = this.width;
	var map = this.map;
	
	// Holds the list of current points to work outwards from
	var stack = [];
	// We store the next level in its own stack
	var newStack = [];
	// Relative positions or new cells from the current one.  We alternate between the adjacent 4 and 8 cells
	// so that there is an average 1.5 distance for diagonals which is close to the actual sqrt(2) ~ 1.41
	var positions = [[[0,1], [0,-1], [1,0], [-1,0]], 
	                 [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]]];
	
	//Set the distance of the start point to be 1 to distinguish it from the impassable areas
	map[start[0] + w*(start[1])] = 1;
	stack.push(start);
	
	// while there are new points being added to the stack
	while (stack.length > 0){
		//run through the current stack
		while (stack.length > 0){
			var cur = stack.pop();
			// stop when we reach the end point
			if (cur[0] == end[0] && cur[1] == end[1]){
				return;
			}
			
			var dist = map[cur[0] + w*(cur[1])] + 1;
			// Check the positions adjacent to the current cell
			for (var i = 0; i < positions[dist % 2].length; i++){
				var pos = positions[dist % 2][i];
				var cell = cur[0]+pos[0] + w*(cur[1]+pos[1]);
				if (cell >= 0 && cell < this.length && map[cell] > dist){
					map[cell] = dist;
					newStack.push([cur[0]+pos[0], cur[1]+pos[1]]);
				}
			}
		}
		// Replace the old empty stack with the newly filled one.
		stack = newStack;
		newStack = [];
	}
	
};

PathFinder.prototype.walkGradient = function(start){
	var positions = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
	
	var cur = start;
	var w = this.width;
	var dist = this.map[cur[0] + w*cur[1]];
	var moved = false;
	while (this.map[cur[0] + w*cur[1]] !== 0){
		for (var i = 0; i < positions.length; i++){
			var pos = positions[i];
			var cell = cur[0]+pos[0] + w*(cur[1]+pos[1]);
			if (cell >= 0 && cell < this.length && this.map[cell] > 0 &&  this.map[cell] < dist){
				dist = this.map[cell];
				this.map[cell] = 0xFFFF;
				cur = [cur[0]+pos[0], cur[1]+pos[1]];
				moved = true;
				break;
			}
		}
		if (!moved){
			break;
		}
		moved = false;
	}
	
	return cur;
};

PathFinder.prototype.countAttached = function(pos){
	var positions = [[0,1], [0,-1], [1,0], [-1,0]];
	var w = this.width;
	var val = this.map[pos[0] + w*pos[1]];
	
	var stack = [pos];
	var used = {};
	
	while (stack.length > 0){
		var cur = stack.pop();
		used[cur[0] + " " + cur[1]] = true;
		for (var i = 0; i < positions.length; i++){
			var p = positions[i];
			var cell = cur[0]+p[0] + w*(cur[1]+p[1]);
			
		}
	}
};

/*
 * Accessibility inherits from TerrainAnalysis
 *  
 * Determines whether there is a path from one point to another.  It is initialised with a single point (p1) and then 
 * can efficiently determine if another point is reachable from p1.  Initialising the object is costly so it should be 
 * cached.   
 */

function Accessibility(gameState, location){
	this.TerrainAnalysis(gameState);
	
	var start = this.findClosestPassablePoint(this.gamePosToMapPos(location));
	
	// Put the value 1 in all accessible points on the map
	this.floodFill(start);
}

copyPrototype(Accessibility, TerrainAnalysis);

// Return true if the given point is accessible from the point given when initialising the Accessibility object. #
// If the given point is impassable the closest passable point is used.
Accessibility.prototype.isAccessible = function(position){
	var s = this.findClosestPassablePoint(this.gamePosToMapPos(position));
	
	return this.map[s[0] + this.width * s[1]] === 1;
};

// fill all of the accessible areas with value 1
Accessibility.prototype.floodFill = function(start){
	var w = this.width;
	var map = this.map;
	
	// Holds the list of current points to work outwards from
	var stack = [];
	// We store new points to be added to the stack temporarily in here while we run through the current stack
	var newStack = [];
	// Relative positions or new cells from the current one.
	var positions = [[0,1], [0,-1], [1,0], [-1,0]];
	
	// Set the start point to be accessible
	map[start[0] + w*(start[1])] = 1;
	stack.push(start);
	
	// while there are new points being added to the stack
	while (stack.length > 0){
		//run through the current stack
		while (stack.length > 0){
			var cur = stack.pop();
			
			var dist = map[cur[0] + w*(cur[1])] + 1;
			// Check the positions adjacent to the current cell
			for (var i = 0; i < positions.length; i++){
				var pos = positions[i];
				var cell = cur[0]+pos[0] + w*(cur[1]+pos[1]);
				if (cell >= 0 && cell < this.length && map[cell] > 1){
					map[cell] = 1;
					newStack.push([cur[0]+pos[0], cur[1]+pos[1]]);
				}
			}
		}
		// Replace the old empty stack with the newly filled one.
		stack = newStack;
		newStack = [];
	}
};