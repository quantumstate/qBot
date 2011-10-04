var BuildingConstructionPlan = function(gameState, type) {
	this.type = gameState.applyCiv(type);

	var template = gameState.getTemplate(this.type);
	if (!template) {
		this.invalidTemplate = true;
		warn("Cannot build " + this.type);
		return;
	}
	this.category = "building";
	this.cost = new Resources(template.cost());
	this.number = 1;
};

BuildingConstructionPlan.prototype.canExecute = function(gameState) {
	if (this.invalidTemplate)
		return false;

	// TODO: verify numeric limits etc

	var builders = gameState.findBuilders(this.type);

	return (builders.length != 0);
};

BuildingConstructionPlan.prototype.execute = function(gameState) {
	// warn("Executing BuildingConstructionPlan "+uneval(this));

	var builders = gameState.findBuilders(this.type).toEntityArray();

	// We don't care which builder we assign, since they won't actually
	// do the building themselves - all we care about is that there is
	// some unit that can start the foundation

	var pos = this.findGoodPosition(gameState);

	builders[0].construct(this.type, pos.x, pos.z, pos.angle);
};

BuildingConstructionPlan.prototype.getCost = function() {
	return this.cost;
};

/**
 * Make each cell's 16-bit value at least one greater than each of its
 * neighbours' values. (If the grid is initialised with 0s and 65535s, the
 * result of each cell is its Manhattan distance to the nearest 0.)
 * 
 * TODO: maybe this should be 8-bit (and clamp at 255)?
 */
BuildingConstructionPlan.prototype.expandInfluences = function(grid, w, h) {
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

/**
 * Add a circular linear-falloff shape to a grid.
 */
BuildingConstructionPlan.prototype.addInfluence = function(grid, w, h, cx, cy, maxDist, strength) {
	strength = strength ? strength : 1;
	var x0 = Math.max(0, cx - maxDist);
	var y0 = Math.max(0, cy - maxDist);
	var x1 = Math.min(w, cx + maxDist);
	var y1 = Math.min(h, cy + maxDist);
	for ( var y = y0; y < y1; ++y) {
		for ( var x = x0; x < x1; ++x) {
			var dx = x - cx;
			var dy = y - cy;
			var r = Math.sqrt(dx * dx + dy * dy);
			if (r < maxDist)
				grid[x + y * w] += strength * (maxDist - r);
		}
	}
};

BuildingConstructionPlan.prototype.findGoodPosition = function(gameState) {
	var template = gameState.getTemplate(this.type);
	var self = this;

	var cellSize = 4; // size of each tile

	// First, find all tiles that are far enough away from obstructions:

	var map = gameState.getMap();

	var obstructionMask = gameState.getPassabilityClassMask("foundationObstruction");
	// Only accept valid land tiles (we don't handle docks yet)
	obstructionMask |= gameState.getPassabilityClassMask("building-land");

	var obstructionTiles = new Uint16Array(map.data.length);
	for ( var i = 0; i < map.data.length; ++i){
		obstructionTiles[i] = (map.data[i] & obstructionMask) ? 0 : 65535;
	}

	// Engine.DumpImage("tiles0.png", obstructionTiles, map.width,
	// map.height, 64);

	this.expandInfluences(obstructionTiles, map.width, map.height);

	// Compute each tile's closeness to friendly structures:

	var friendlyTiles = new Uint16Array(map.data.length);

	gameState.getOwnEntities().forEach(function(ent) {
		if (ent.hasClass("Structure")) {
			var infl = 32;
			if (ent.hasClass("CivCentre"))
				infl *= 4;

			var pos = ent.position();
			var x = Math.round(pos[0] / cellSize);
			var z = Math.round(pos[1] / cellSize);
			if (template._template.BuildRestrictions.Category === "Field"){
				if (ent.resourceDropsiteTypes() && ent.resourceDropsiteTypes().indexOf("food") !== -1){
					self.addInfluence(friendlyTiles, map.width, map.height, x, z, infl);
				}
			}else{
				self.addInfluence(friendlyTiles, map.width, map.height, x, z, infl);
				if (ent.hasClass("CivCentre")){
					self.addInfluence(friendlyTiles, map.width, map.height, x, z, infl/8, -4);
				}
			}
			
				
		}
	});

	// Find target building's approximate obstruction radius,
	// and expand by a bit to make sure we're not too close
	var radius = Math.ceil(template.obstructionRadius() / cellSize);

	// Find the best non-obstructed tile
	var bestIdx = 0;
	var bestVal = -1;
	for ( var i = 0; i < map.data.length; ++i) {
		if (obstructionTiles[i] > radius) {
			var v = friendlyTiles[i];
			if (v > bestVal) {
				bestVal = v;
				bestIdx = i;
			}
		}
	}
	var x = ((bestIdx % map.width) + 0.5) * cellSize;
	var z = (Math.floor(bestIdx / map.width) + 0.5) * cellSize;

	// Engine.DumpImage("tiles1.png", obstructionTiles, map.width,
	// map.height, 32);
	// Engine.DumpImage("tiles2.png", friendlyTiles, map.width, map.height,
	// 256);

	// default angle
	var angle = Math.PI/4;

	return {
		"x" : x,
		"z" : z,
		"angle" : angle
	};
};
