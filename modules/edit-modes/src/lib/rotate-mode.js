// @flow

import turfCentroid from '@turf/centroid';
import turfBearing from '@turf/bearing';
import turfTransformRotate from '@turf/transform-rotate';
import type {
  PointerMoveEvent,
  StartDraggingEvent,
  StopDraggingEvent,
  ModeProps
} from '../types.js';
import type { FeatureCollection, Position } from '../geojson-types.js';
import { BaseGeoJsonEditMode, type GeoJsonEditAction } from './geojson-edit-mode.js';
import { ImmutableFeatureCollection } from './immutable-feature-collection.js';

export class RotateMode extends BaseGeoJsonEditMode {
  _isRotatable: boolean;
  _geometryBeingRotated: ?FeatureCollection;

  handlePointerMove(event: PointerMoveEvent, props: ModeProps<FeatureCollection>) {
    this._isRotatable =
      Boolean(this._geometryBeingRotated) || this.isSelectionPicked(event.picks, props);

    this.updateCursor(props);

    if (!this._isRotatable || !event.pointerDownMapCoords) {
      // Nothing to do
      return;
    }

    if (event.isDragging && this._geometryBeingRotated) {
      // Rotate the geometry
      props.onEdit(
        this.getRotateAction(event.pointerDownMapCoords, event.mapCoords, 'rotating', props)
      );
    }

    // TODO: is there a less hacky way to prevent map panning?
    // cancel map panning
    event.sourceEvent.stopPropagation();
  }

  handleStartDragging(event: StartDraggingEvent, props: ModeProps<FeatureCollection>) {
    if (!this._isRotatable) {
      return;
    }

    this._geometryBeingRotated = this.getSelectedFeaturesAsFeatureCollection(props);
  }

  handleStopDragging(event: StopDraggingEvent, props: ModeProps<FeatureCollection>) {
    if (this._geometryBeingRotated) {
      // Rotate the geometry
      props.onEdit(
        this.getRotateAction(event.pointerDownMapCoords, event.mapCoords, 'rotated', props)
      );
      this._geometryBeingRotated = null;
    }
  }

  updateCursor(props: ModeProps<FeatureCollection>) {
    if (this._isRotatable) {
      // TODO: look at doing SVG cursors to get a better "rotate" cursor
      props.onUpdateCursor('move');
    } else {
      props.onUpdateCursor(null);
    }
  }

  getRotateAction(
    startDragPoint: Position,
    currentPoint: Position,
    editType: string,
    props: ModeProps<FeatureCollection>
  ): GeoJsonEditAction {
    const startPosition = startDragPoint;
    const centroid = turfCentroid(this._geometryBeingRotated);
    const angle = getRotationAngle(centroid, startPosition, currentPoint);

    const rotatedFeatures = turfTransformRotate(this._geometryBeingRotated, angle);

    let updatedData = new ImmutableFeatureCollection(props.data);

    const selectedIndexes = props.selectedIndexes;
    for (let i = 0; i < selectedIndexes.length; i++) {
      const selectedIndex = selectedIndexes[i];
      const movedFeature = rotatedFeatures.features[i];
      updatedData = updatedData.replaceGeometry(selectedIndex, movedFeature.geometry);
    }

    return {
      updatedData: updatedData.getObject(),
      editType,
      editContext: {
        featureIndexes: selectedIndexes
      }
    };
  }
}

function getRotationAngle(centroid: Position, startDragPoint: Position, currentPoint: Position) {
  const bearing1 = turfBearing(centroid, startDragPoint);
  const bearing2 = turfBearing(centroid, currentPoint);
  return bearing2 - bearing1;
}
