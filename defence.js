function Defence(){
	this.AQUIRE_DIST = 22000;
	this.RELEASE_DIST = 30000;
	
	this.GROUP_RADIUS = 20; // units will be added to a group if they are within this radius
	this.GROUP_BREAK_RADIUS = 40; // units will leave a group if they are outside of this radius
	this.GROUP_MERGE_RADIUS = 10; // Two groups with centres this far apart will be merged TODO: implement
	
	// These are objects with the keys being object ids and values being the entity objects
	this.attackers = {}; // Enemy soldiers which are attacking our base
	this.defenders = {}; // Our soldiers currently being used for defence
	
	this.groups = [];
}

Defence.prototype.update = function(gameState, events, militaryManager){
	Engine.ProfileStart("Defence Manager");
	var enemyTroops = militaryManager.getEnemySoldiers();
	
	this.updateAttackers(gameState, events, enemyTroops);
	
	debug(this.newAttackers);
	
	this.updateGroups();
	
	debug(this.groups);
	
	Engine.ProfileStop();
};

// Returns an entity collection of key buildings which should be defended.
// Currently just returns civ centres
Defence.prototype.getKeyBuildings = function(gameState){
	return gameState.getOwnEntities().filter(Filters.byClass("CivCentre"));
};

Defence.prototype.updateAttackers = function(gameState, events, enemyTroops){
	var self = this;
	
	var keyBuildings = this.getKeyBuildings(gameState);
	
	this.newAttackers = [];
	this.oldAttackers = this.attackers;
	this.attackers = {};
	
	enemyTroops.forEach(function(ent){
		if (ent.position()){
			var minDist = Math.min();
			keyBuildings.forEach(function(building){
				if (building.position() && VectorDistance(ent.position(), building.position()) < minDist){
					minDist = VectorDistance(ent.position(), building.position());
				}
			});
			
			if (self.oldAttackers[ent.id()]){
				if (minDist < self.RELEASE_DIST){
					self.attackers[ent.id()] = ent;
				}
			}else{
				if (minDist < self.AQUIRE_DIST){
					self.attackers[ent.id()] = ent;
					self.newAttackers.push(ent.id());
				}
			}
		}
	});
};

Defence.prototype.updateGroups = function(){
	
	for (var i = 0; i < this.groups.length; i++){
		var group = this.groups[i];
		// remove members which are no longer attackers
		for (var j = 0; j < group.members.length; j++){
			if (!this.attackers[group.members[j]]){
				group.members.splice(j, 1);
				j--;
			}
		}
		// recalculate centre of group
		group.sumPosition = [0,0];
		for (var j = 0; j < group.members.length; j++){
			group.sumPosition[0] += this.attackers[group.members[j]].position()[0];
			group.sumPosition[1] += this.attackers[group.members[j]].position()[1];
		}
		group.position[0] = group.sumPosition[0]/group.members.length;
		group.position[1] = group.sumPosition[1]/group.members.length;
		
		// remove members that are too far away
		for (var j = 0; j < group.members.length; j++){
			if ( VectorDistance(this.attackers[group.members[j]].position(), group.position) > this.GROUP_BREAK_RADIUS){
				this.newAttackers.push(group.members[j]);
				group.sumPosition[0] -= this.attackers[group.members[j]].position()[0];
				group.sumPosition[1] -= this.attackers[group.members[j]].position()[1];
				group.members.splice(j, 1);
				j--;
			}
		}
		
		if (group.members.length === 0){
			this.groups.splice(i, 1);
			i--;
		}
		
		group.position[0] = group.sumPosition[0]/group.members.length;
		group.position[1] = group.sumPosition[1]/group.members.length;
	}
	
	// add ungrouped attackers to groups
	for (var j in this.newAttackers){
		var ent = this.attackers[this.newAttackers[j]];
		var foundGroup = false;
		for (var i in this.groups){
			if (VectorDistance(ent.position(), this.groups[i].position) <= this.GROUP_RADIUS){
				this.groups[i].members.push(ent.id());
				
				this.groups[i].sumPosition[0] += ent.position()[0];
				this.groups[i].sumPosition[1] += ent.position()[1];
				this.groups[i].position[0] = this.groups[i].sumPosition[0]/this.groups[i].members.length;
				this.groups[i].position[1] = this.groups[i].sumPosition[1]/this.groups[i].members.length;
				
				foundGroup = true;
				break;
			}
		}
		if (!foundGroup){
			this.groups.push({"members": [ent.id()],
	             "position": [ent.position()[0], ent.position()[1]],
	             "sumPosition": [ent.position()[0], ent.position()[1]]});
		}
	}
	
	// merge groups which are close together
	for (var i = 0; i < this.groups.length; i++){
		for (var j = 0; j < this.groups.length; j++){
			if (this.groups[i].members.length < this.groups[j].members.length){
				if (VectorDistance(this.groups[i].position, this.groups[j].position) < this.GROUP_MERGE_RADIUS){
					this.groups[j].members = this.groups[i].members.concat(this.groups[j].members);
					this.groups[j].sumPosition[0] += this.groups[i].sumPosition[0];
					this.groups[j].sumPosition[1] += this.groups[i].sumPosition[1];
					this.groups[j].position[0] = this.groups[j].sumPosition[0]/this.groups[j].members.length;
					this.groups[j].position[1] = this.groups[j].sumPosition[1]/this.groups[j].members.length;
					
					this.groups.splice(i, 1);
					i--;
				}
			}
		}
	}
};