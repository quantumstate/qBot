Entity.prototype.deleteMetadata = function(id) {
	delete this._ai._entityMetadata[this.id()];
};
