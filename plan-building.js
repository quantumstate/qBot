var BuildingConstructionPlan = function(gameState, type, position) {
	this.type = gameState.applyCiv(type);
	this.position = position;

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

	var cellSize = 4; // size of each tile

	// First, find all tiles that are far enough away from obstructions:

	var obstructionMap = Map.createObstructionMap(gameState);
	// Engine.DumpImage("tiles0.png", obstructionTiles, map.width,
	// map.height, 64);

	obstructionMap.expandInfluences();

	// Compute each tile's closeness to friendly structures:

	var friendlyTiles = new Map(gameState);
	
	if (this.position){
		var x = Math.round(this.position[0] / cellSize);
		var z = Math.round(this.position[1] / cellSize);
		friendlyTiles.addInfluence(x, z, 200);
		friendlyTiles.dumpIm("pos.png",	200);
	}else{			
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
						friendlyTiles.addInfluence(x, z, infl);
					}
				}else{
					friendlyTiles.addInfluence(x, z, infl);
					if (ent.hasClass("CivCentre")){
						friendlyTiles.addInfluence(x, z, infl/8, -4);
					}
				}
				
					
			}
		});
	}

	// Find target building's approximate obstruction radius,
	// and expand by a bit to make sure we're not too close
	var radius = Math.ceil(template.obstructionRadius() / cellSize);

	// Find the best non-obstructed tile
	var bestIdx = friendlyTiles.findBestTile(radius, obstructionMap)[0];
	
	var x = ((bestIdx % friendlyTiles.width) + 0.5) * cellSize;
	var z = (Math.floor(bestIdx / friendlyTiles.width) + 0.5) * cellSize;

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
