var AttackMoveToCC = function(gameState, militaryManager){
	this.minAttackSize = 20;
	this.maxAttackSize = 60;
	this.idList=[];
	
	this.previousTime = 0;
	this.state = "unexecuted";
	
	this.healthRecord = [];
};

// Returns true if the attack can be executed at the current time 
AttackMoveToCC.prototype.canExecute = function(gameState, militaryManager){
	var enemyStrength = militaryManager.measureEnemyStrength(gameState);
	var enemyCount = militaryManager.measureEnemyCount(gameState);
	
	// We require our army to be >= this strength
	var targetStrength = enemyStrength * 1.5;
	
	var availableCount = militaryManager.countAvailableUnits();
	var availableStrength = militaryManager.measureAvailableStrength();
	
	debug("Troops needed for attack: " + this.minAttackSize + " Have: " + availableCount);
	debug("Troops strength for attack: " + targetStrength + " Have: " + availableStrength);
	
	return ((availableStrength >= targetStrength && availableCount >= this.minAttackSize)
			|| availableCount >= this.maxAttackSize);
};

// Executes the attack plan, after this is executed the update function will be run every turn
AttackMoveToCC.prototype.execute = function(gameState, militaryManager){
	var availableCount = militaryManager.countAvailableUnits();
	this.idList = militaryManager.getAvailableUnits(availableCount);
	
	var pending = EntityCollectionFromIds(gameState, this.idList);
	
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
		this.targetPos = target.position();

		pending.move(this.targetPos[0], this.targetPos[1]);
	} else if (targets.length == 0 ) {
		gameState.ai.gameFinished = true;
	}
	
	this.state = "walking";
};

// Runs every turn after the attack is executed
// This removes idle units from the attack
AttackMoveToCC.prototype.update = function(gameState, militaryManager, events){
	// keep the list of units in good order by pruning ids with no corresponding entities (i.e. dead units)
	var removeList = [];
	var sumPos = [0, 0];
	var totalHealth = 0;
	for (var idKey in this.idList){
		var id = this.idList[idKey];
		var ent = militaryManager.entity(id);
		if (ent === undefined){
			removeList.push(id);
		}else{
			if (ent.position()){
				sumPos[0] += ent.position()[0];
				sumPos[1] += ent.position()[1];
			}
			if (ent.hitpoints()){
				totalHealth += ent.hitpoints();
			}
		}
	}
	for (var i in removeList){
		this.idList.splice(this.idList.indexOf(removeList[i]),1);
	}
	
	var deltaHealth = 0;
	var deltaTime = 1;
	var time = gameState.getTimeElapsed();
	this.healthRecord.push([totalHealth, time]);
	if (this.healthRecord.length > 1){
		for (var i = this.healthRecord.length - 1; i >= 0; i--){
			deltaHealth = totalHealth - this.healthRecord[i][0];
			deltaTime = time - this.healthRecord[i][1];
			if (this.healthRecord[i][1] < time - 5*1000){
				break;
			}
		}
	}
	
	var numUnits = this.idList.length;
	if (numUnits < 1) return;
	var damageRate = -deltaHealth / deltaTime * 1000;
	var centrePos = [sumPos[0]/numUnits, sumPos[1]/numUnits];
	debug(damageRate);
	if ((damageRate / Math.sqrt(numUnits)) > 2){
		if (this.state === "walking"){
			var sumAttackerPos = [0,0];
			var numAttackers = 0;
			
			for (var key in events){
				var e = events[key];
				//{type:"Attacked", msg:{attacker:736, target:1133, type:"Melee"}}
				if (e.type === "Attacked" && e.msg){
					if (this.idList.indexOf(e.msg.target) !== -1){
						var attacker = militaryManager.entity(e.msg.attacker);
						if (attacker && attacker.position()){
							sumAttackerPos[0] += attacker.position()[0];
							sumAttackerPos[1] += attacker.position()[1];
							numAttackers += 1;
						}
					}
				}
			}
			if (numAttackers > 0){
				var avgAttackerPos = [sumAttackerPos[0]/numAttackers, sumAttackerPos[1]/numAttackers];
				var units = EntityCollectionFromIds(gameState, this.idList);
				// move to halfway between current position and attackers position
				units.move((avgAttackerPos[0] + centrePos[0])/2, (avgAttackerPos[1] + centrePos[1])/2);
				this.state = "attacking";
			}
		}
	}else{
		if (this.state === "attacking"){
			var units = EntityCollectionFromIds(gameState, this.idList);
			var idleCount = 0;
			units.forEach(function(ent){
				if (ent.isIdle()){
					idleCount += 1;
				}
			});
			//idle count currently disabled to see how well it works without it.
			if (true || idleCount/this.idList.length > 0.8){
				units.move(this.targetPos[0], this.targetPos[1]);
				this.state = "walking";
			}
		}
	}
	
	this.previousTime = time;
	this.previousHealth = totalHealth;
	
	debug(this.state);
};
