/**
 * @author mrdoob / http://mrdoob.com/
 * @author bhouston / http://exocortex.com/
 */

( function ( THREE ) {

	THREE.Raycaster = function ( origin, direction, near, far ) {

		this.ray = new THREE.Ray( origin, direction );

		// normalized ray.direction required for accurate distance calculations
		if ( this.ray.direction.lengthSq() > 0 ) {

			this.ray.direction.normalize();

		}

		this.near = near || 0;
		this.far = far || Infinity;

	};

	var sphere = new THREE.Sphere();
	var localRay = new THREE.Ray();
	var facePlane = new THREE.Plane();
	var intersectPoint = new THREE.Vector3();
	var matrixPosition = new THREE.Vector3();

	var inverseMatrix = new THREE.Matrix4();

	var descSort = function ( a, b ) {

		return a.distance - b.distance;

	};

	var intersectObject = function ( object, raycaster, intersects ) {

		if ( object instanceof THREE.Particle ) {

			matrixPosition.getPositionFromMatrix( object.matrixWorld );
			var distance = raycaster.ray.distanceToPoint( matrixPosition );

			if ( distance > object.scale.x ) {

				return intersects;

			}

			intersects.push( {

				distance: distance,
				point: object.position,
				face: null,
				object: object

			} );

		} else if ( object instanceof THREE.LOD ) {

			matrixPosition.getPositionFromMatrix( object.matrixWorld );
			var distance = raycaster.ray.origin.distanceTo( matrixPosition );

			intersectObject( object.getObjectForDistance( distance ), raycaster, intersects );

		} else if (object instanceof THREE.Mesh ) {

			// Checking boundingSphere distance to ray
			matrixPosition.getPositionFromMatrix( object.matrixWorld );
			sphere.set( matrixPosition, object.geometry.boundingSphere.radius * object.matrixWorld.getMaxScaleOnAxis() );

			if ( raycaster.ray.isIntersectionSphere( sphere ) === false ) {

				return intersects;

			}

			var geometry = object.geometry;
			var vertices = geometry.vertices;

			if ( geometry instanceof THREE.BufferGeometry ) {

				var isFaceMaterial = object.material instanceof THREE.MeshFaceMaterial;
				var objectMaterials = isFaceMaterial === true ? object.material.materials : null;

				var side = object.material.side;

				var a, b, c;
				var precision = raycaster.precision;

				inverseMatrix.getInverse(object.matrixWorld);

				localRay.copy(raycaster.ray).applyMatrix4(inverseMatrix);

				if (!geometry.dynamic) return intersects;

				var fl;
				var indexed = false;
				if (geometry.attributes.index) {
					indexed = true;
					fl = geometry.attributes.index.numItems / 3;
				} else {
					fl = geometry.attributes.position.numItems / 9;
				}

				for (var f = 0; f < fl; f++) {

					if (indexed) {
						a = geometry.attributes.index.array[f * 3];
						b = geometry.attributes.index.array[f * 3 + 1];
						c = geometry.attributes.index.array[f * 3 + 2];
					} else {
						a = f * 3;
						b = f * 3 + 1;
						c = f * 3 + 2;
					}

					var v1 = [geometry.attributes.position.array[a * 3],
								geometry.attributes.position.array[a * 3 + 1],
								geometry.attributes.position.array[a * 3 + 2]];
					var v2 = [geometry.attributes.position.array[b * 3],
								geometry.attributes.position.array[b * 3 + 1],
								geometry.attributes.position.array[b * 3 + 2]];
					var v3 = [geometry.attributes.position.array[c * 3],
								geometry.attributes.position.array[c * 3 + 1],
								geometry.attributes.position.array[c * 3 + 2]];

					var material = object.material;
					if (material === undefined) continue;

					var cb = new THREE.Vector3(), ab = new THREE.Vector3();
					var vA = new THREE.Vector3(v1[0], v1[1], v1[2]);
					var vB = new THREE.Vector3(v2[0], v2[1], v2[2]);
					var vC = new THREE.Vector3(v3[0], v3[1], v3[2]);

					cb.subVectors(vC, vB);
					ab.subVectors(vA, vB);
					cb.cross(ab);
					cb.normalize();

					facePlane.setFromNormalAndCoplanarPoint(cb, vA);

					var planeDistance = localRay.distanceToPlane(facePlane);

					// bail if raycaster and plane are parallel
					if (Math.abs(planeDistance) < precision) continue;

					// if negative distance, then plane is behind raycaster
					if (planeDistance < 0) continue;

					// check if we hit the wrong side of a single sided face
					side = material.side;
					if (side !== THREE.DoubleSide) {

						var planeSign = localRay.direction.dot(facePlane.normal);

						if (!(side === THREE.FrontSide ? planeSign < 0 : planeSign > 0)) continue;

					}

					// this can be done using the planeDistance from localRay because localRay wasn't normalized, but ray was
					if (planeDistance < raycaster.near || planeDistance > raycaster.far) continue;

					intersectPoint = localRay.at(planeDistance, intersectPoint); // passing in intersectPoint avoids a copy

					if (!THREE.Triangle.containsPoint(intersectPoint, vA, vB, vC)) continue;

					var face = new THREE.Face3(a, b, c);
					var colors = geometry.attributes.color.array;
					face.vertexColors[0] = new THREE.Color(colors[a * 3], colors[a * 3 + 1], colors[a * 3 + 2]);
					face.vertexColors[1] = new THREE.Color(colors[b * 3], colors[b * 3 + 1], colors[b * 3 + 2]);
					face.vertexColors[2] = new THREE.Color(colors[c * 3], colors[c * 3 + 1], colors[c * 3 + 2]);
					intersects.push({
						distance: planeDistance, // this works because the original ray was normalized, and the transformed localRay wasn't
						point: raycaster.ray.at(planeDistance),
						face: face,
						faceIndex: f,
						object: object
					});

				}

			} else if ( geometry instanceof THREE.Geometry ) {

				var isFaceMaterial = object.material instanceof THREE.MeshFaceMaterial;
				var objectMaterials = isFaceMaterial === true ? object.material.materials : null;

				var side = object.material.side;

				var a, b, c, d;
				var precision = raycaster.precision;

				inverseMatrix.getInverse( object.matrixWorld );

				localRay.copy( raycaster.ray ).applyMatrix4( inverseMatrix );

				for ( var f = 0, fl = geometry.faces.length; f < fl; f ++ ) {

					var face = geometry.faces[ f ];

					var material = isFaceMaterial === true ? objectMaterials[ face.materialIndex ] : object.material;

					if ( material === undefined ) continue;

					facePlane.setFromNormalAndCoplanarPoint( face.normal, vertices[face.a] );

					var planeDistance = localRay.distanceToPlane( facePlane );

					// bail if raycaster and plane are parallel
					if ( Math.abs( planeDistance ) < precision ) continue;

					// if negative distance, then plane is behind raycaster
					if ( planeDistance < 0 ) continue;

					// check if we hit the wrong side of a single sided face
					side = material.side;
					if ( side !== THREE.DoubleSide ) {

						var planeSign = localRay.direction.dot( facePlane.normal );

						if ( ! ( side === THREE.FrontSide ? planeSign < 0 : planeSign > 0 ) ) continue;

					}

					// this can be done using the planeDistance from localRay because localRay wasn't normalized, but ray was
					if ( planeDistance < raycaster.near || planeDistance > raycaster.far ) continue;

					intersectPoint = localRay.at( planeDistance, intersectPoint ); // passing in intersectPoint avoids a copy

					if ( face instanceof THREE.Face3 ) {

						a = vertices[ face.a ];
						b = vertices[ face.b ];
						c = vertices[ face.c ];

						if ( ! THREE.Triangle.containsPoint( intersectPoint, a, b, c ) ) continue;

					} else if ( face instanceof THREE.Face4 ) {

						a = vertices[ face.a ];
						b = vertices[ face.b ];
						c = vertices[ face.c ];
						d = vertices[ face.d ];

						if ( ( ! THREE.Triangle.containsPoint( intersectPoint, a, b, d ) ) &&
							 ( ! THREE.Triangle.containsPoint( intersectPoint, b, c, d ) ) ) continue;

					} else {

						// This is added because if we call out of this if/else group when none of the cases
						//    match it will add a point to the intersection list erroneously.
						throw Error( "face type not supported" );

					}

					intersects.push( {

						distance: planeDistance,	// this works because the original ray was normalized, and the transformed localRay wasn't
						point: raycaster.ray.at( planeDistance ),
						face: face,
						faceIndex: f,
						object: object

					} );

				}

			}

		}

	};

	var intersectDescendants = function ( object, raycaster, intersects ) {

		var descendants = object.getDescendants();

		for ( var i = 0, l = descendants.length; i < l; i ++ ) {

			intersectObject( descendants[ i ], raycaster, intersects );

		}
	};

	//

	THREE.Raycaster.prototype.precision = 0.0001;

	THREE.Raycaster.prototype.set = function ( origin, direction ) {

		this.ray.set( origin, direction );

		// normalized ray.direction required for accurate distance calculations
		if ( this.ray.direction.length() > 0 ) {

			this.ray.direction.normalize();

		}

	};

	THREE.Raycaster.prototype.intersectObject = function ( object, recursive ) {

		var intersects = [];

		if ( recursive === true ) {

			intersectDescendants( object, this, intersects );

		}

		intersectObject( object, this, intersects );

		intersects.sort( descSort );

		return intersects;

	};

	THREE.Raycaster.prototype.intersectObjects = function ( objects, recursive ) {

		var intersects = [];

		for ( var i = 0, l = objects.length; i < l; i ++ ) {

			intersectObject( objects[ i ], this, intersects );

			if ( recursive === true ) {

				intersectDescendants( objects[ i ], this, intersects );

			}
		}

		intersects.sort( descSort );

		return intersects;

	};

}( THREE ) );
