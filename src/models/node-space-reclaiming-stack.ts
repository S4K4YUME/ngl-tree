import {Node} from "./node";

/** @author Nico Klaassen */

/**
 * Augmented tree structure which extends the Node interface
 * Used to support the simple (nested) tree map visualization
 */
export interface NodeSpaceReclaimingStack extends Node {
    children: NodeSpaceReclaimingStack[];
    parent?: NodeSpaceReclaimingStack;
    identifier: number;
    orientation?: number; // actually it is Orientation, but this cannot be imported.
    topleft?: number[];
    topright?: number[];
    bottomleft?: number[];
    bottomright?: number[];
    depth?: number; // Depth of the node
}
/** @end-author Nico Klaassen */
