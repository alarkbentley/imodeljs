/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Viewport } from "./Viewport";
import { ViewManager } from "./ViewManager";
import { BeButtonEvent } from "./tools/Tool";
import { SnapMode, HitList, SnapDetail, SnapHeat, HitDetail, SubSelectionMode, HitSource, HitDetailType } from "./HitDetail";
import { SnapContext } from "./ViewContext";
import { ElementLocateManager, SnapType, SnapStatus, HitListHolder } from "./ElementLocateManager";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { AccuSnap } from "./AccuSnap";

// tslint:disable:variable-name
// tslint:disable:no-conditional-assignment

export class TentativePoint {
  public static instance = new TentativePoint();
  public isActive = false;
  public qualifierMask = 0;        // button qualifiers
  public candidateSnapMode = SnapMode.First;    // during snap creation: the snap to try
  public currSnap?: SnapDetail;
  public tpHits?: HitList;
  public readonly snapPaths: HitList;
  public hotDistanceInches = 0.21;
  public readonly rawPoint = new Point3d();     // world coordinates
  public readonly point = new Point3d();        // world coords (adjusted for locks)
  public readonly viewPt = new Point3d();       // view coordinate system
  public viewport?: Viewport;

  private isSnappedToIntersectionCandidate(): boolean { return !!this.currSnap && (SnapMode.IntersectionCandidate === this.currSnap.m_snapMode); }
  public setHitList(list?: HitList) { this.tpHits = list; }

  /** @return true if the tentative point is currently active and snapped to an element. */
  public isSnapped(): boolean { return !!this.currSnap; }

  /** @return The current snap path when TentativePoint.isSnapped or undefined. */
  public getCurrSnap(): SnapDetail | undefined { return this.currSnap; }

  public getPoint(): Point3d {
    const snapPath = this.currSnap;
    return !snapPath ? this.point : snapPath.getAdjustedPoint();
  }

  public clear(doErase: boolean): void {
    if (doErase) {
      this.removeTentative();
      elementLocateManager.synchSnapMode();
    }
    accuSnap.destroy();
    this.isActive = false;
    this.snapPaths.empty();
    this.setCurrSnap(undefined);
    this.tpHits = undefined;
  }

  public removeTentative(): void {
    if (!this.isActive)
      return;

    accuSnap.erase();

    if (this.getCurrSnap())
      viewManager.invalidateDecorationsAllViews();
    else
      this.viewport!.invalidateDecorations();

    this.isActive = false;
  }

  public getTPSnapMode(): SnapMode { return (SnapMode.Intersection === this.activeSnapMode()) ? SnapMode.Nearest : this.activeSnapMode(); }
  public activeSnapMode(): SnapMode { return (this.candidateSnapMode !== SnapMode.First) ? this.candidateSnapMode : SnapMode.Nearest; }
  public setCurrSnap(newSnap?: SnapDetail): void {
    if (newSnap) {
      newSnap.m_subSelectionMode = SubSelectionMode.Segment;
      newSnap.m_heat = SnapHeat.InRange;
    }
    this.currSnap = newSnap;
  }

  public showTentative(): void {
    if (this.isSnapped()) {
      viewManager.invalidateDecorationsAllViews();
      accuSnap.displayInfoBalloon(this.viewPt, this.viewport!, undefined);
    } else {
      this.viewport!.invalidateDecorations();
    }
    this.isActive = true;
  }

  public clearElementFromHitList(element: Id64): void {
    if (element.isValid())
      this.snapPaths.removeHitsFrom(element);
  }

  public getHitAndList(holder: HitListHolder): SnapDetail | undefined {
    const hit = this.currSnap;
    if (hit) {
      holder.setHitList(this.tpHits);
      this.tpHits = undefined;
    }
    return hit;
  }

  public onButtonEvent(): void {
    this.removeTentative();
    elementLocateManager.synchSnapMode();
    this.snapPaths.empty();
    this.setCurrSnap(undefined);
    this.tpHits = undefined;
  }

  public isView3d(): boolean { return this.viewport!.view.is3d(); }

  /** draw the cross as 4 lines rather than 2, so that there's no hole in the middle when drawn in dashed symbology */
  // private drawTpCross(graphic: GraphicBuilder, tpSize: number, x: number, y: number): void {
  // DPoint2d    tpCross[2];
  // tpCross[0].x = x;
  // tpCross[0].y = y;

  // tpCross[1] = tpCross[0];
  // tpCross[1].x += tpSize;
  // graphic.AddLineString2d(2, tpCross, 0.0);

  // tpCross[1].x = x - tpSize;
  // graphic.AddLineString2d(2, tpCross, 0.0);

  // tpCross[1].x = x;
  // tpCross[1].y = y + tpSize;
  // graphic.AddLineString2d(2, tpCross, 0.0);

  // tpCross[1].y = y - tpSize;
  // graphic.AddLineString2d(2, tpCross, 0.0);
  // }

  // private displayTP(context: DecorateContext): void {
  // const viewport = context.viewport;

  // if (!this.isActive || !viewport)
  //   return;

  // DVec2d dpiScale = viewport -> GetRenderTarget() -> GetDevice() -> _GetDpiScale();
  // int tpSize = (int)(40 * (dpiScale.x + dpiScale.y) / 2);

  // DPoint3d center = viewport -> WorldToView(m_point);

  // // draw a "background shadow" line: wide, black, mostly transparent
  // const graphic = context.createViewOverlay();
  // ColorDef color(0, 0, 0, 225);
  // graphic -> SetSymbology(color, color, 7);
  // drawTpCross(* graphic, tpSize + 2, center.x + 1, center.y + 1);

  // // draw a background line: narrow, black, slightly transparent (this is in case we're not snapped and showing a dotted line)
  // color = ColorDef(0, 0, 0, 10);
  // graphic -> SetSymbology(color, color, 3);
  // drawTpCross(* graphic, tpSize + 1, center.x, center.y);

  // // off-white (don't want white/black reversal), slightly transparent
  // color = ColorDef(0xfe, 0xff, 0xff, 10);
  // graphic -> SetSymbology(color, color, 1, IsSnapped() ? LinePixels :: Solid : LinePixels:: Code2);

  // drawTpCross(* graphic, tpSize, center.x, center.y);
  // context.AddViewOverlay(* graphic -> Finish());

  // // Draw snapped segment...
  // if (nullptr != m_currSnap)
  //   m_currSnap -> Draw(context);
  // }

  public getNextSnap(): SnapDetail | undefined {
    const snap = this.snapPaths.getNextHit() as SnapDetail;
    if (snap)   // Report which of the multiple active modes we are using
      elementLocateManager.setChosenSnapMode(SnapType.Points, snap.m_snapMode);
    return snap;
  }

  /** find an intersection between the current snap path and one of the other paths in the current hitlist. */
  private doTPIntersectSnap(_inHit: HitDetail | undefined, changeFirst: boolean): SnapDetail | undefined {

    // use the current snapped path as the first path for the intersection
    const currSnap = this.getCurrSnap()!;
    const firstHit = currSnap;

    // // if we're already showing an intersection, use the "second" path as the new first path
    // if (changeFirst && (HitDetailType.Intersection === firstHit.getHitType()))
    //   firstHit = ((IntersectDetail *) firstHit) -> GetSecondHit();

    // // keep searching hits for an acceptable intersection
    // HitList intsctList;
    // for (secondHit = inHit; secondHit; secondHit = ElementLocateManager:: GetManager().GetElementPicker().GetNextHit())
    // {
    //   SnapDetailP thisIntsct = nullptr;
    //   if (SnapStatus:: Success == intsctCtx.IntersectDetails(& thisIntsct, firstHit, secondHit, & m_point, true))
    //   {
    //     intsctList.AddHit(thisIntsct, false, false);
    //     thisIntsct -> Release(); // ref count was incremented when we added to list
    //   }
    // }

    // intsctPath = (SnapDetail *) intsctList.GetHit(0);
    // if (nullptr != intsctPath) {
    //   intsctPath -> AddRef();
    //   intsctPath -> SetSnapMode(SnapMode.Intersection);
    //   ElementLocateManager:: GetManager()._SetChosenSnapMode(SnapType:: Points, SnapMode.Intersection);
    //   return intsctPath;
    // }

    // We couldn't find an intersection, so now we have to decide what to show. If we were previously
    // showing an intersection, and the mouse moved to a new location (that's what "changeFirst" means), then
    // that probably means that s/he was trying to find a new element, but missed. In that case, we re-activate the
    // previous hit as the new snap, but of course we don't show it as an intersection. If we were not previously
    // snapped to an intersection, then s/he just missed, start the TP over and return a nullptr.
    return (changeFirst && (currSnap !== firstHit)) ? firstHit : undefined;
  }

  /*  We're looking for the second path for an intersection.
  *   m_currHit already points to the first path.
  *   nextHit is the next snapPath after m_currHit in m_snapPaths.
  * Multiple snaps:
  *   Because m_snapPaths can contain snaps of different types and because
  *   this list is sorted by proximity to the cursor, the
  *   SnapMode::IntersectionCandidate snaps may not be contiguous in the list.
  * This function returns the next snapPath in the m_snapPaths list that is
  *   a SnapMode::IntersectionCandidate snapPath. This might be nextHit, or
  *   it might be a snapPath farther along.
  */
  private findNextIntersectionCandidate(nextHit: SnapDetail | undefined): SnapDetail | undefined {
    if (!nextHit)
      return undefined;

    if (SnapMode.IntersectionCandidate === nextHit.m_snapMode)
      return nextHit;

    if (this.snapPaths.m_currHit === -1)
      return undefined; // There is no current hit?! This happens when we TP twice to the same element.

    //  Now search for the NEXT intersection target
    // m_currHit already points to the item in the list that follows nextHit
    for (let iSnapDetail = this.snapPaths.m_currHit; iSnapDetail < this.snapPaths.size(); ++iSnapDetail) {
      const snap = this.snapPaths.hits[iSnapDetail] as SnapDetail;
      if (SnapMode.IntersectionCandidate === snap.m_snapMode)
        return snap;
    }

    return undefined;
  }

  private optimizeHitList(): void {
    // Remove snaps that refer to same point on same element
    // (This makes it less frustrating to the user when stepping through atl. points!)
    for (let iSnapDetail = 0; iSnapDetail < this.snapPaths.size(); ++iSnapDetail) {
      const snap = this.snapPaths.getHit(iSnapDetail)! as SnapDetail;
      const snapElem = snap.m_elementId;

      if (!snapElem.isValid())
        continue;

      let foundAny = false;
      for (let jSnapDetail = iSnapDetail + 1; jSnapDetail < this.snapPaths.size(); ++jSnapDetail) {
        const otherSnap = this.snapPaths.getHit(jSnapDetail)! as SnapDetail;

        if (otherSnap.getAdjustedPoint().isExactEqual(snap.getAdjustedPoint())) {
          if (snapElem.equals(otherSnap.m_elementId)) {
            this.snapPaths.setHit(jSnapDetail, undefined);
            foundAny = true;
          }
        }
      }

      if (foundAny)
        this.snapPaths.dropNulls();
    }
  }

  private async testHitsForSnapMode(snapContext: SnapContext, snapMode: SnapMode): Promise<BentleyStatus> {
    this.tpHits!.resetCurrentHit();
    this.candidateSnapMode = snapMode;

    let thisPath: HitDetail | undefined;
    while (thisPath = this.tpHits!.getNextHit()) {
      const snapPath = await snapContext.snapToPath(thisPath, this.getTPSnapMode(), elementLocateManager.getKeypointDivisor(), thisPath.m_viewport.pixelsFromInches(this.hotDistanceInches));
      if (snapPath) {
        // Original hit list is already sorted...preserve order...
        this.snapPaths.insert(-1, snapPath);

        // Annotate the SnapDetail with the snap mode that was used to generate it
        if (SnapMode.Intersection === snapMode)
          snapPath.m_snapMode = SnapMode.IntersectionCandidate; // NB! This identifies the first of the two needed
      }
    }

    this.candidateSnapMode = SnapMode.First;
    return BentleyStatus.SUCCESS;
  }

  private getSnaps(): SnapDetail | undefined {
    // clear any current snaps
    this.snapPaths.empty();

    // make sure we don't have any hits.
    this.tpHits = undefined;

    const currHit = accuSnap.getHitAndList(this) as SnapDetail;

    // use existing AccuSnap hit list if one exists...
    if (!currHit) {
      // search for elements around the current raw point (search should not be affected by locks!)
      const aperture = (2.0 * this.viewport!.pixelsFromInches(elementLocateManager.getApertureInches()) / 2.0) + 1.5;
      const options = elementLocateManager.getLocateOptions().clone(); // Copy to avoid changing out from under active Tool...
      const picker = elementLocateManager.getElementPicker();
      picker.empty();
      options.hitSource = HitSource.TentativeSnap;

      if (0 === picker.doPick(this.viewport!, this.rawPoint, aperture, options))
        return undefined;

      this.tpHits = picker.getHitList(true);
    }

    // Construct each active point snap mode
    const snaps = elementLocateManager.getPreferredPointSnapModes(HitSource.TentativeSnap);
    const snapContext = new SnapContext();
    for (const snap of snaps) {
      this.testHitsForSnapMode(snapContext, snap);
    }

    this.optimizeHitList();

    // if something is AccuSnapped, make that the current tp snap
    if (currHit && HitDetailType.Snap <= currHit.getHitType()) {
      // now we have to remove that path from the tp list.
      this.snapPaths.removeHitsFrom(currHit.m_elementId);
      this.snapPaths.resetCurrentHit();
      return currHit;
    }

    return this.getNextSnap();
  }

  private static arePointsCloseEnough(pt1: Point3d, pt2: Point3d, pixelDistance: number): boolean {
    const aperture = pixelDistance + 1.5;
    return pt1.distance(pt2) < aperture;
  }

  public process(ev: BeButtonEvent): void {
    // remove the TP cross if it's already on the screen
    this.removeTentative();

    const lastPtView = this.viewPt;

    this.viewport = ev.viewport!;
    this.point.setFrom(ev.point);
    this.rawPoint.setFrom(ev.rawPoint);
    this.viewPt.setFrom(ev.viewPoint);
    this.qualifierMask = ev.keyModifiers;

    let snap: SnapDetail | undefined;
    const snapAgain = (this.isSnapped() && TentativePoint.arePointsCloseEnough(lastPtView, this.viewPt, this.viewport!.pixelsFromInches(elementLocateManager.getApertureInches())));

    snap = snapAgain ? this.getNextSnap() : this.getSnaps();

    // If the the previous snap was done in intersection mode,
    // we now want to try to find intersections with the previous snap.
    if (this.isSnappedToIntersectionCandidate()) {
      // (If the mouse didn't move, then keep the previous "first" path and try to find more intersections with it.)
      const intersectSnap = this.doTPIntersectSnap(this.findNextIntersectionCandidate(snap), !snapAgain);

      //  If we can't create an intersection, then move on to the next active snap
      if (intersectSnap)
        snap = intersectSnap;
    }

    if (snap && elementLocateManager.isConstraintSnapActive()) {
      //  Does the user actually want to create a constraint?
      //  (Note you can't construct a constraint on top of a partially defined intersection)
      if (SnapMode.IntersectionCandidate !== snap.m_snapMode) {
        //  Construct constraint on top of TP
        snap.m_heat = SnapHeat.InRange;  // If we got here, the snap is "in range". Tell xSnap_convertToConstraint.
        if (SnapStatus.Success !== elementLocateManager.performConstraintSnap(snap, this.viewport.pixelsFromInches(elementLocateManager.getApertureInches()), HitSource.TentativeSnap)) {
          snap = undefined;
        }
      }
    }

    this.setCurrSnap(snap); //  Adopt the snap as current
    accuSnap.clear(); // make sure there's no AccuSnap active after a tentative point (otherwise we continually snap to it).

    if (this.isSnapped())
      this.point.setFrom(this.currSnap!.m_snapPoint);

    this.showTentative(); // show the TP cross
  }
}

const accuSnap = AccuSnap.instance;
const viewManager = ViewManager.instance;
const elementLocateManager = ElementLocateManager.instance;
