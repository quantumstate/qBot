function Defence(){
	this.AQUIRE_DIST = 220;
	this.RELEASE_DIST = 300;
	
	// These are objects containing ... TODO:: finish comment 
	this.attackers = {}; // Enemy soldiers which are attacking our base
	this.defenders = {}; // Our soldiers currently being used for defence
	
	this.groups = [];
}

Defence.prototype.update = function(gameState, events, militaryManager){
	Engine.ProfileStart("Defence Manager");
	var enemyTroops = militaryManager.getEnemySoldiers;
	
	
	
	Engine.ProfileStop();
};

// Returns an entity collection of key buildings which should be defended.
// Currently just returns civ centres
Defence.prototype.getKeyBuildings = function(gameState){
	return gameState.getOwnEntities().filter(Filters.byClass("CivCentre"));
};

Defence.prototype.updateAttackers = function(gameState, events, enemyTroops){
	var self = this;
	
	var removeList = [];
	this.attackersObjects = [];
	
	var keyBuildings = this.getKeyBuildings();
	
	for (var id in this.attackers){
		var attacker = gameState.getEntityById(id);
		if (!attacker){
			removeList.push(id);
			continue;
		}
		
		if (attacker.position()){
			inRange = false;
			keyBuildings.forEach(function(ent){
				if (ent.position() && VectorDistance(ent.position(), attacker.position()) < self.RELEASE_DIST){
					inRange = true;
				}
			});
			if (! inRange){
				removeList.push(id);
				continue;
			}
		}
		
		this.attackers[id] = attacker;
	}
	for (var i = 0; i < removeList.length; i++){
		delete this.attackers[removeList[i]];
	}
	
	enemyTroops.forEach(function(ent){
		if (ent.position()){
			var minDist = Math.min();
			keyBuildings.forEach(function(building){
				if (ent.position() && VectorDistance(ent.position(), attacker.position()) < minDist){
					minDist = VectorDistance(ent.position(), attacker.position());
				}
			});
			
		}
	});
};

Defence.prototype.detectGroups = function(ents) {
	var GROUP_RADIUS = 20;
	
	var groups = [];
	
	ents.forEach(function(ent){
		if (ent.position()){
			for (var i in groups){
				if (VectorDistance(ent.position(), groups[i].position) <= GROUP_RADIUS){
					groups[i].members.push(ent);
					
					groups[i].sumPosition[0] += ent.position()[0];
					groups[i].sumPosition[1] += ent.position()[1];
					groups[i].position[0] = groups[i].sumPosition[0]/groups[i].members.length;
					groups[i].position[1] = groups[i].sumPosition[1]/groups[i].members.length;
					return;
				}
			}
			groups.push({"members": [ent],
			             "position": [ent.position[0], ent.position[1]],
			             "sumPosition": [ent.position[0], ent.position[1]]});
		}
	});
	
	return groups;
};

Defence.prototype.detectGroups2 = function(ents) {
	var GROUP_RADIUS = 20;
	var GRID_SIZE = 10;
	
	var top = Math.max();
	var bottom = Math.min();
	var left = Math.max();
	var right = Math.min();
	var pos = [];
	ents.forEach(function(ent){
		if (ent.position()){
			pos.push([ent.position(), ent.id()]);
			if (ent.position()[0] < left){
				left = ent.position()[0];
			}
			if (ent.position()[0] > right){
				right = ent.position()[0];
			}
			if (ent.position()[1] < top){
				top = ent.position()[1];
			}
			if (ent.position()[1] < bottom){
				bottom = ent.position()[1];
			}
		}
	});
	
	var width = right - left;
	var height = bottom - top;
	if (width <= 0 || height <= 0){
		return undefined;
	} 
	
	var grid = [];
	for (var i = 0; i < GRID_SIZE; i++){
		grid.push([]);
		for (var j = 0; j < GRID_SIZE; j++){
			grid[i].push([]);
		}
	}
	
	for (var i in pos){
		
	}
};