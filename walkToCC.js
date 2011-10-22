var WalkToCC = function(){
	this.minAttackSize = 20;
	this.maxAttackSize = 60;
	this.idList=[];
};

WalkToCC.prototype.execute = function(gameState, militaryManager){
	var maxStrength = militaryManager.measureEnemyStrength(gameState);
	var maxCount = militaryManager.measureEnemyCount(gameState);
	
	this.targetSquadSize = maxCount * 1.5;
	this.targetStrength = maxStrength * 1.5;
	
	// Find the units ready to join the attack
	var availableCount = militaryManager.countAvailableUnits();
	var removeList = [];
	for (var idKey in this.idList){
		var id = this.idList[idKey];
		var ent = militaryManager.entity(id);
		if(ent)
		{
			if(ent.isIdle()) {
				militaryManager.unassignUnit(id);
				removeList.push(id);
			}
		} else {
			removeList.push(id);
		}
	}
	for (i in removeList){
		this.idList.splice(this.idList.indexOf(removeList[i]),1);
	}
	
	availableCount = militaryManager.countAvailableUnits();
	var availableStrength = militaryManager.measureAvailableStrength();
	
	debug("Troops needed for attack: " + this.targetSquadSize + " Have: " + availableCount);
	debug("Troops strength for attack: " + this.targetStrength + " Have: " + availableStrength);
	
	// If we have enough units or strength yet, start the attack
	if ((availableStrength >= this.targetStrength && availableCount >= this.minAttackSize)
			|| availableCount >= this.maxAttackSize) {
		
		var list = militaryManager.getAvailableUnits(availableCount);
		this.idList = this.idList.concat(list);
		
		var pending = EntityCollectionFromIds(gameState, list);
		
		// Find the critical enemy buildings we could attack
		var targets = militaryManager.getEnemyBuildings(gameState,"ConquestCritical");
		// If there are no critical structures, attack anything else that's critical
		if (targets.length == 0) {
			targets = gameState.entities.filter(function(ent) {
				return (gameState.isEntityEnemy(ent) && ent.hasClass("ConquestCritical") && ent.owner() !== 0);
			});
		}
		// If there's nothing, attack anything else that's less critical
		if (targets.length == 0) {
			targets = militaryManager.getEnemyBuildings(gameState,"Town");
		}
		if (targets.length == 0) {
			targets = militaryManager.getEnemyBuildings(gameState,"Village");
		}

		// If we have a target, move to it
		if (targets.length) {
			// Remove the pending role
			pending.forEach(function(ent) {
				ent.setMetadata("role", "attack");
			});

			var target = targets.toEntityArray()[0];
			var targetPos = target.position();

			// TODO: this should be an attack-move command
			pending.move(targetPos[0], targetPos[1]);
		} else if (targets.length == 0 ) {
			gameState.ai.gameFinished = true;
		}
	}
};
