import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {Node} from '../../models/node';

@Component({
    selector: 'app-tree-navigator',
    templateUrl: './tree-navigator.component.html',
})
export class TreeNavigatorComponent implements OnInit {
    /** @author Bart Wesselink */
    @Input() tree: Node|Node[];

    public current: Node[] = [];

    public static transformToNavigatorNode(node: Node): Node {
        return {
            label: node.label,
            children: [],
            expandable: node.children.length > 0,
            original: node,
        };
    }

    public ngOnInit() {
        // check if input is root node (not an array)
        if (!(this.tree instanceof Array)) {
            this.tree = [this.tree]; // transform to array
        }

        this.initialize();
    }

    public reset(): void {
        // contract all
        for (const node of this.current) {
            node.children = [];
        }

        this.initialize();
    }

    public update(nodes: Node[]) {
        this.tree = nodes;
        this.initialize();
    }

    private initialize(): void {
        this.current = [];

        // create a flat tree, such that Angular does not have to loop over the whole tree when it is not expanded
        for (const node of (this.tree as Node[])) {
            this.current.push(TreeNavigatorComponent.transformToNavigatorNode(node));
        }
    }
    /** @end-author Bart Wesselink */
}