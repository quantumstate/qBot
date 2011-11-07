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
	if (!pos){
		debug("No room to place " + this.type);
		return;
	}

	builders[0].construct(this.type, pos.x, pos.z, pos.angle);
};

BuildingConstructionPlan.prototype.getCost = function() {
	return this.cost;
};

BuildingConstructionPlan.prototype.findGoodPosition = function(gameState) {
	var template = gameState.getTemplate(this.type);

	var cellSize = gameState.cellSize; // size of each tile

	// First, find all tiles that are far enough away from obstructions:

	var obstructionMap = Map.createObstructionMap(gameState,template);
	// Engine.DumpImage("tiles0.png", obstructionTiles, map.width,
	// map.height, 64);

	obstructionMap.expandInfluences();
	
	// Compute each tile's closeness to friendly structures:

	var friendlyTiles = new Map(gameState);
	
	if (this.position){
		var x = Math.round(this.position[0] / cellSize);
		var z = Math.round(this.position[1] / cellSize);
		friendlyTiles.addInfluence(x, z, 200);
		//friendlyTiles.dumpIm("pos.png",	200);
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
						friendlyTiles.addInfluence(x, z, infl, infl);
					}
				}else{
					friendlyTiles.addInfluence(x, z, infl);
					if (ent.hasClass("CivCentre")){
						friendlyTiles.addInfluence(x, z, infl/8, -infl/2);
					}
				}
				
					
			}
		});
	}

	// Find target building's approximate obstruction radius,
	// and expand by a bit to make sure we're not too close
	var radius = Math.ceil(template.obstructionRadius() / cellSize) + 2;

	// Find the best non-obstructed tile
	var bestTile = friendlyTiles.findBestTile(radius, obstructionMap);
	var bestIdx = bestTile[0];
	var bestVal = bestTile[1];
	
	if (bestVal === -1){
		return false;
	}
	
	var x = ((bestIdx % friendlyTiles.width) + 0.5) * cellSize;
	var z = (Math.floor(bestIdx / friendlyTiles.width) + 0.5) * cellSize;
	
	//friendlyTiles.dumpIm("friendly.png");

	// Engine.DumpImage("tiles1.png", obstructionTiles, map.width,
	// map.height, 32);
	// Engine.DumpImage("tiles2.png", friendlyTiles, map.width, map.height,
	// 256);

	// default angle
	var angle = 3*Math.PI/4;

	return {
		"x" : x,
		"z" : z,
		"angle" : angle
	};
};
