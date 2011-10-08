function Map(gameState, originalMap){
	var gameMap = gameState.getMap();
	this.width = gameMap.width;
	this.height = gameMap.height;
	this.length = gameMap.data.length;
	if (originalMap){
		this.map = originalMap;
	}else{
		this.map = new Uint16Array(this.length);
	}
}

Map.createObstructionMap = function(gameState){
	var map = gameState.getMap();

	var obstructionMask = gameState.getPassabilityClassMask("foundationObstruction");
	// Only accept valid land tiles (we don't handle docks yet)
	obstructionMask |= gameState.getPassabilityClassMask("building-land");

	var obstructionTiles = new Uint16Array(map.data.length);
	for ( var i = 0; i < map.data.length; ++i){
		obstructionTiles[i] = (map.data[i] & obstructionMask) ? 0 : 65535;
	}
	
	return new Map(gameState, obstructionTiles);
};

Map.prototype.addInfluence = function(cx, cy, maxDist, strength) {
	strength = strength ? strength : 1;
	var x0 = Math.max(0, cx - maxDist);
	var y0 = Math.max(0, cy - maxDist);
	var x1 = Math.min(this.width, cx + maxDist);
	var y1 = Math.min(this.height, cy + maxDist);
	for ( var y = y0; y < y1; ++y) {
		for ( var x = x0; x < x1; ++x) {
			var dx = x - cx;
			var dy = y - cy;
			var r = Math.sqrt(dx * dx + dy * dy);
			if (r < maxDist){
				if (-1*(strength*(maxDist - r)) > this.map[x + y * this.width]){
					this.map[x + y * this.width] = 0;
				}else{
					this.map[x + y * this.width] += strength * (maxDist - r);
				}
			}
		}
	}
};

/**
 * Make each cell's 16-bit value at least one greater than each of its
 * neighbours' values. (If the grid is initialised with 0s and 65535s, the
 * result of each cell is its Manhattan distance to the nearest 0.)
 * 
 * TODO: maybe this should be 8-bit (and clamp at 255)?
 */
Map.prototype.expandInfluences = function() {
	var w = this.width;
	var h = this.height;
	var grid = this.map;
	for ( var y = 0; y < h; ++y) {
		var min = 65535;
		for ( var x = 0; x < w; ++x) {
			var g = grid[x + y * w];
			if (g > min)
				grid[x + y * w] = min;
			else if (g < min)
				min = g;
			++min;
		}

		for ( var x = w - 2; x >= 0; --x) {
			var g = grid[x + y * w];
			if (g > min)
				grid[x + y * w] = min;
			else if (g < min)
				min = g;
			++min;
		}
	}

	for ( var x = 0; x < w; ++x) {
		var min = 65535;
		for ( var y = 0; y < h; ++y) {
			var g = grid[x + y * w];
			if (g > min)
				grid[x + y * w] = min;
			else if (g < min)
				min = g;
			++min;
		}

		for ( var y = h - 2; y >= 0; --y) {
			var g = grid[x + y * w];
			if (g > min)
				grid[x + y * w] = min;
			else if (g < min)
				min = g;
			++min;
		}
	}
};

Map.prototype.findBestTile = function(radius, obstructionTiles){
	// Find the best non-obstructed tile
	var bestIdx = 0;
	var bestVal = -1;
	for ( var i = 0; i < this.length; ++i) {
		if (obstructionTiles.map[i] > radius) {
			var v = this.map[i];
			if (v > bestVal) {
				bestVal = v;
				bestIdx = i;
			}
		}
	}
	
	return [bestIdx, bestVal];
};

// Multiplies current map by the parameter map pixelwise 
Map.prototype.multiply = function(map){
	for (var i = 0; i < this.length; i++){
		this.map[i] *= map.map[i];
	}
};

Map.prototype.dumpIm = function(name, threshold){
	name = name ? name : "default.png";
	threshold = threshold ? threshold : 256;
	Engine.DumpImage(name, this.map, this.width, this.height, threshold);
};
