var WalkToCC = function(){
	this.minAttackSize = 20;
	this.maxAttackSize = 60;
};

WalkToCC.prototype.execute = function(gameState, militaryManager){
	var maxStrength = militaryManager.measureEnemyStrength(gameState);
	
	this.targetSquadSize = maxStrength * 2;
	
	// Find the units ready to join the attack
	var availableCount = militaryManager.countAvailableUnits();
	//var pending = gameState.getOwnEntitiesWithRole("attack-pending");
	
	debug("Troops needed for attack: " + this.targetSquadSize + " Have: " + availableCount);
	
	// If we have enough units yet, start the attack
	if ((availableCount >= this.targetSquadSize && availableCount >= this.minAttackSize)
			|| availableCount >= this.maxAttackSize) {
		var idList = militaryManager.getAvailableUnits(availableCount);
		var pending = EntityCollectionFromIds(gameState, idList);
		
		// Find the enemy CCs we could attack
		var targets = gameState.entities.filter(function(ent) {
			return (ent.isEnemy() && ent.hasClass("CivCentre"));
		});

		// If there's no CCs, attack anything else that's critical
		if (targets.length == 0) {
			targets = gameState.entities.filter(function(ent) {
				return (ent.isEnemy() && ent.hasClass("ConquestCritical"));
			});
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
		}
	}
};