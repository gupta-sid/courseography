
/**
 * Calculates the position of the click in relation to the page.
 * @param {} e The click event.
 * @param {HTMLElement} elem The target of the click event.
 * @return The position of the click.
 */
function getClickPosition(e, elem) {
    'use-strict';

    // console.log(e.clientX, e.clientY);
    var parentPosition = getPosition(elem);
    var xPosition = e.clientX - parentPosition.x;
    var yPosition = e.clientY - parentPosition.y;
    xPosition = Math.round(xPosition / 4) * 4; // for snapping!!
    yPosition = Math.round(yPosition / 4) * 4;

    return { x: xPosition, y: yPosition };
}

/**
 * Calculates the position of elem in relation to the page.
 * @param {HTMLElement} elem The target of the click event.
 * @return The position of elem on the page.
 */
function getPosition(elem) {
    'use-strict';

    var xPosition = 0;
    var yPosition = 0;
      
    while (elem) {
        // || 0 -> for mozilla firefox compatability !!
        xPosition += (elem.offsetLeft || 0) - elem.scrollLeft + elem.clientLeft;
        yPosition += (elem.offsetTop || 0) - elem.scrollTop + elem.clientTop;
        // console.log(elem.offsetLeft, elem.scrollLeft, elem.clientLeft);
        // console.log(elem.offsetTop, elem.scrollTop, elem.clientTop);
        // console.log(elem.offsetLeft, elem.offsetTop);
        // console.log(elem);
        elem = elem.offsetParent;
    }
    return { x: xPosition, y: yPosition };
}

/**
 * In node-mode creates a new node at the position of the click event on the SVG canvas.
 * In path-mode creates an elbow at the position of the click event on the SVG canvas,
                if the startNode is defined.
 * @param {} e The click event.
 */
function makeNodePath(e) {
    'use-strict';

    var position = getClickPosition(e, e.currentTarget);
    if (mode === 'node-mode') {
        var g = document.createElementNS(xmlns, 'g');
        var node = document.createElementNS(xmlns, 'rect');

        g.setAttribute('class', 'node');
        g.setAttribute('id', 'g' + nodeId);
        g.setAttribute('data-active', 'active');
        g.setAttribute('data-group', nodeColourId);
    
        node.setAttribute('x', position.x);
        node.setAttribute('y', position.y);
        node.setAttribute('rx', 4);
        node.setAttribute('ry', 4);
        node.setAttribute('id', 'n' + nodeId);
        node.setAttribute('width', nodeWidth);
        node.setAttribute('height', nodeHeight);
        node.setAttribute('class', 'node');
        node.parents = [];
        node.kids = []; 
        // note: children doesn't work because javascript objects already have a children attribute
        node.inEdges = [];
        node.outEdges = [];
        
        g.appendChild(node);
        svgDoc.appendChild(g);
        document.getElementById('n' + nodeId).addEventListener('mousedown', nodeClicked, false);

        select(document.getElementById('n' + nodeId));

        nodeId += 1;
    } else if (mode === 'path-mode') {
        // make elbow joint, only if the dummy point is outside the starting node
        if (startNode !== null && ((position.x < parseFloat(startNode.getAttribute('x'), 10)) || 
                                  (position.x > parseFloat(startNode.getAttribute('x'), 10) + nodeWidth) ||
                                  (position.y < parseFloat(startNode.getAttribute('y'), 10)) || 
                                  (position.y > parseFloat(startNode.getAttribute('y'), 10) + nodeHeight))) {           
            if (curPath === null) { // node to elbow path
                var pathString = findClosest({x: parseFloat(startNode.getAttribute('x'), 10), 
                                  y: parseFloat(startNode.getAttribute('y'), 10)},
                                  'node', position, 'elbow');
                startPath(pathString);
            } else { // elbow to elbow path
                curPath.setAttributeNS(null, 'd', curPath.getAttribute('d') + 'L' + position.x + ',' + position.y + ' ');   
            }

            makeElbow(position);
        }
    }
}


function nodeClicked(e) {
    'use-strict';

    
    var index = null;

    if (mode  === 'erase-mode') { 
        // remove any paths leading to and from this node from the other node's 
        // list of paths and remove this node from the other nodes' adjacency lists
        e.currentTarget.inEdges.map(function (edge) { 
            // Remove edge from parent's outEdges and current node from parent's kids list
            var edgeParent = document.getElementById(edge.id.slice(0, edge.id.lastIndexOf('n')));
            index = edgeParent.outEdges.indexOf(edge);
            if (index > -1) {
                edgeParent.outEdges.splice(index, 1);
            }
            index = edgeParent.kids.indexOf(e.currentTarget);
            if (index > -1) {
                edgeParent.kids.splice(index, 1);
            }
            erasePath(edge);
        });
        e.currentTarget.outEdges.map(function (edge) {
            // Remove edge from children's inEdges and current node from child's parents list
            var edgeChild = document.getElementById(edge.id.slice(edge.id.lastIndexOf('n')));
            index = edgeChild.inEdges.indexOf(edge);
            if (index > -1) {
                edgeChild.inEdges.splice(index, 1);
            }
            index = edgeChild.parents.indexOf(e.currentTarget);
            if (index > -1) {
                edgeChild.parents.splice(index, 1);
            }
            erasePath(edge);
        });
        svgDoc.removeChild(e.currentTarget.parentNode);
    } else if (mode === 'change-mode') {
        var position = getClickPosition(e, e.currentTarget);
        nodeMoving = e.currentTarget;
        prevX = position.x;
        prevY = position.y;
        
        // show which node has been selected
        select(e.currentTarget);

    } else if (mode === 'path-mode') {
        if (startNode === null) {
            startNode = e.currentTarget;
            select(e.currentTarget);
        } else if (startNode === e.currentTarget) {
            // this is the start node of the path about to be created, self loops not allowed
            if (curPath !== null) {
                curPath.elbows.map(function (item) {
                    svgDoc.removeChild(item);
                });
                svgDoc.removeChild(curPath);
                curPath = null;
            }
        } else {
            // make the path from startNode to current node then make startNode Null
            var pathId = startNode.id + e.currentTarget.id;
            if (document.getElementById(pathId) === null) {
                finishPath(pathId, e.currentTarget);
                startNode = null;
                curPath = null;
            } else {
                // a path between these two nodes already, duplicates not allowed
                startNode = null;
                if (curPath !== null) {
                    curPath.elbows.map(function (item) {
                        svgDoc.removeChild(item);
                    });
                    svgDoc.removeChild(curPath);
                    curPath = null;
                }
            }
        }
    }
}


function select(newNode) {
    'use-strict';

    if (nodeSelected !== null) {
        nodeSelected.parentNode.setAttribute('data-active', 'unselected');
    }
    nodeSelected = newNode;
    nodeSelected.parentNode.setAttribute('data-active', 'active');
}


function moveNodeElbow(e) {
    'use-strict';

    if (mode === 'change-mode') {
        if (nodeMoving !== null) {
            var position = getClickPosition(e, nodeMoving);
            var rectX = parseFloat(nodeMoving.getAttribute('x'), 10);
            var rectY = parseFloat(nodeMoving.getAttribute('y'), 10);
            rectX += (position.x - prevX);
            rectY += (position.y - prevY);
            nodeMoving.setAttribute('x', rectX);
            nodeMoving.setAttribute('y', rectY);

            if (nodeMoving.parentNode.childNodes.length > 1) {
                // move text
                var textNode = nodeMoving.parentNode.childNodes[1];
                var textX = parseFloat(textNode.getAttribute('x'), 10);
                var textY = parseFloat(textNode.getAttribute('y'), 10);
                textX += (position.x - prevX);
                textY += (position.y - prevY);
                textNode.setAttribute('x', textX);
                textNode.setAttribute('y', textY);
            }
            
            // move in and out edges by the same amount
            nodeMoving.inEdges.map(function (item) { // modify last node in path
                movePath(item, (position.x - prevX), (position.y - prevY), 'end', -1);
            });
            nodeMoving.outEdges.map(function (item) { // modify the first node in path
                movePath(item, (position.x - prevX), (position.y - prevY), 'start', -1);
            });   

            prevX = position.x;
            prevY = position.y;
        } else if (elbowMoving !== null) {
            var position = getClickPosition(e, elbowMoving);
            // move dummy node 
            var elbowX = parseFloat(elbowMoving.getAttribute('cx'), 10);
            var elbowY = parseFloat(elbowMoving.getAttribute('cy'), 10);
            elbowX += (position.x - prevX);
            elbowY += (position.y - prevY);
            elbowMoving.setAttribute('cx', elbowX);
            elbowMoving.setAttribute('cy', elbowY);

            // move actual elbow in path
            movePath(document.getElementById(elbowMoving.path), 
                     (position.x - prevX), (position.y - prevY), 'elbow',
                     document.getElementById(elbowMoving.path).elbows.indexOf(elbowMoving));

            prevX = position.x;
            prevY = position.y;
        }
    }
}


function unclickAll(e) {
    'use-strict';

    if (mode === 'change-mode') {
        nodeMoving = null;
        prevX = -1;
        prevY = -1;
        elbowMoving = null;
    }
}



// TODO:
/*
 1. regions creation
 2. get substantial work done with saving graph 
 3. node type buttons

 * deselecting
 * look into https://www.dashingd3js.com/svg-paths-and-d3js
 */

// RANDOM
/*
 * shortcuts: http://javascript.info/tutorial/keyboard-events
              http://unixpapa.com/js/key.html
 * document ready method ?
 * make grid background optional
 * colour picker for choosing colour of node
 */