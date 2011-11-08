/**
 * Vanilla Masonry v1.0 beta
 * A dynamic layout plugin. The flip-side of CSS Floats
 *
 * Licensed under the MIT license.
 * Copyright 2011 David DeSandro
 */

(function( window, undefined ) {

  'use strict';

  // -------------------------- DOM Utility -------------------------- //

  // from bonzo.js, by Dustin Diaz - https://github.com/ded/bonzo

  function classReg(c) {
    return new RegExp("(^|\\s+)" + c + "(\\s+|$)");
  }

  function hasClass(el, c) {
    return classReg(c).test(el.className);
  }
  function addClass(el, c) {
    if ( !hasClass(el, c) ) {
      el.className = el.className + ' ' + c;
    }
  }
  function removeClass(el, c) {
    el.className = el.className.replace(classReg(c), ' ');
  }

  // -------------------------- getStyle -------------------------- //

  var defView = document.defaultView;

  var getStyle = defView && defView.getComputedStyle ?
    function( elem ) {
      return defView.getComputedStyle( elem, null );
    } :
    function( elem ) {
      return elem.currentStyle;
    };

  // -------------------------- getWH -------------------------- //

  // returns width/height of element, refactored getWH from jQuery
  function getWH( elem, measure, isOuter ) {
    // Start with offset property
    var isWidth = measure === 'width',
        val = isWidth ? elem.offsetWidth : elem.offsetHeight,
        dirA = isWidth ? 'Left' : 'Top',
        dirB = isWidth ? 'Right' : 'Bottom',
        computedStyle = getStyle( elem ),
        paddingA = parseFloat( computedStyle[ 'padding' + dirA ] ) || 0,
        paddingB = parseFloat( computedStyle[ 'padding' + dirB ] ) || 0,
        marginA = parseFloat( computedStyle[ 'margin' + dirA ] ) || 0,
        marginB = parseFloat( computedStyle[ 'margin' + dirB ] ) || 0,
        borderA = parseFloat( computedStyle[ 'border' + dirA + 'Width' ] ) || 0,
        borderB = parseFloat( computedStyle[ 'border' + dirB + 'Width' ] ) || 0;

    if ( val > 0 ) {

      if ( isOuter ) {
        // outerWidth, outerHeight, add margin
        val += marginA + marginB;
      } else {
        // like getting width() or height(), no padding or border
        val -= paddingA + paddingB + borderA + borderB;
      }

    } else {

      // Fall back to computed then uncomputed css if necessary
      val = computedStyle[ measure ];
      if ( val < 0 || val == null ) {
        val = elem.style[ measure ] || 0;
      }
      // Normalize "", auto, and prepare for extra
      val = parseFloat( val ) || 0;

      if ( isOuter ) {
        // Add padding, border, margin
        val += paddingA + paddingB + marginA + marginB + borderA + borderB;
      }
    }

    return val;
  }

  window.getWH = getWH;

  // -------------------------- addEvent / removeEvent -------------------------- //

  // by John Resig - http://ejohn.org/projects/flexible-javascript-events/

  function addEvent( obj, type, fn ) {
    if ( obj.addEventListener ) {
      obj.addEventListener( type, fn, false );
    } else if ( obj.attachEvent ) {
      obj[ 'e' + type + fn ] = fn;
      obj[ type + fn ] = function() {
        obj[ 'e' + type + fn ]( window.event );
      };
      obj.attachEvent( "on" + type, obj[ type + fn ] );
    }
  }

  function removeEvent( obj, type, fn ) {
    if ( obj.removeEventListener ) {
      obj.removeEventListener( type, fn, false );
    } else if ( obj.detachEvent ) {
      obj.detachEvent( "on" + type, obj[ type + fn ] );
      obj[ type + fn ] = null;
      obj[ 'e' + type + fn ] = null;
    }
  }

  // -------------------------- debounce -------------------------- //

  // by John Hann - http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/

  function debounce( func, threshold, execAsap ) {
    var timeout;

    return function debounced() {
      var obj = this, args = arguments;
      function delayed () {
        if ( !execAsap ) {
          func.apply( obj, args );
        }
        timeout = null;
      }

      if ( timeout ) {
        clearTimeout( timeout );
      } else if ( execAsap ) {
        func.apply( obj, args );
      }

      timeout = setTimeout(delayed, threshold || 100);
    };

  }

  // -------------------------- Masonry -------------------------- //

  function Masonry( elem, options ) {
    if ( !elem ) {
      // console.error('Element not found for Masonry.')
      return;
    }

    this.element = elem;

    this.options = {};

    for ( var prop in Masonry.defaults ) {
      this.options[ prop ] = Masonry.defaults[ prop ];
    }

    for ( prop in options ) {
      this.options[ prop ] = options[ prop ];
    }

    this._create();
    this.build();
  }

  // styles of container element we want to keep track of
  var masonryContainerStyles = [ 'position', 'height' ];

  Masonry.defaults = {
    isResizable: true,
    gutterWidth: 0,
    isRTL: false,
    isFitWidth: false
  };

  Masonry.prototype = {

    _getBricks: function( items ) {
      var item;
      for (var i=0, len = items.length; i < len; i++ ) {
        item = items[i];
        item.style.position = 'absolute';
        addClass( item, 'masonry-brick' );
        this.bricks.push( item );
      }
    },

    _create: function() {

      // need to get bricks
      this.reloadItems();

      // get original styles in case we re-apply them in .destroy()
      var elemStyle = this.element.style;
      this._originalStyle = {};
      for ( var i=0, len = masonryContainerStyles.length; i < len; i++ ) {
        var prop = masonryContainerStyles[i];
        this._originalStyle[ prop ] = elemStyle[ prop ] || '';
      }

      this.element.style.position = 'relative';

      this.horizontalDirection = this.options.isRTL ? 'right' : 'left';
      this.offset = {};

      // get top left position of where the bricks should be
      var computedStyle = getStyle( this.element ),
          paddingX = this.options.isRTL ? 'paddingRight' : 'paddingLeft';

      this.offset.y = parseFloat( computedStyle.paddingTop ) || 0;
      // get horizontal offset
      this.offset.x = parseFloat( computedStyle[ paddingX ] ) || 0 ;

      this.isFluid = this.options.columnWidth && typeof this.options.columnWidth === 'function';

      // add masonry class first time around
      var instance = this;
      setTimeout( function() {
        addClass( instance.element, 'masonry' );
      }, 0 );

      // bind resize method
      if ( this.options.isResizable ) {
        this.resizeHandler = debounce( function() {
          instance.resize();
        });
        addEvent( window, 'resize', this.resizeHandler );
      }

    },

    // trigger fires when instance is first created
    // and when instance is triggered again -> myMasonry.build();
    build: function( callback ) {
      this._getColumns();
      this._reLayout( callback );
    },

    // calculates number of columns
    // i.e. this.columnWidth = 200
    _getColumns: function() {
      var container = this.options.isFitWidth ? this.element.parentNode : this.element,
          containerWidth = getWH( container, 'width' );

                         // use fluid columnWidth function if there
      this.columnWidth = this.isFluid ? this.options.columnWidth( containerWidth ) :
                    // if not, how about the explicitly set option?
                    this.options.columnWidth ||
                    // Okay then, use the size of the first item
                     getWH( this.bricks[0], 'width', true ) ||
                    // Whatevs, if there's no items, use size of container
                    containerWidth;

      this.columnWidth += this.options.gutterWidth;

      this.cols = Math.floor( ( containerWidth + this.options.gutterWidth ) / this.columnWidth );
      this.cols = Math.max( this.cols, 1 );

    },

    // goes through all children again and gets bricks in proper order
    reloadItems: function() {
      this.bricks = [];
      this._getBricks( this.element.children );
    },

    // ====================== General Layout ======================

    _reLayout: function( callback ) {
      // reset columns
      var i = this.cols;
      this.colYs = [];
      while (i--) {
        this.colYs.push( 0 );
      }
      // apply layout logic to all bricks
      this.layout( this.bricks, callback );
    },

    // used on collection of atoms (should be filtered, and sorted before )
    // accepts bricks-to-be-laid-out to start with
    layout: function( bricks, callback ) {

      // layout logic
      var brick, colSpan, groupCount, groupY, groupColY, j, colGroup;

      for ( var i=0, len = bricks.length; i < len; i++ ) {
        brick = bricks[i];

        // don't try nothing on text, imlookinachu IE6-8
        if ( brick.nodeType !== 1 ) {
          continue;
        }

        //how many columns does this brick span
        colSpan = Math.ceil( getWH( brick, 'width', true ) /
          ( this.columnWidth + this.options.gutterWidth ) );
        colSpan = Math.min( colSpan, this.cols );

        if ( colSpan === 1 ) {
          // if brick spans only one column, just like singleMode
          colGroup = this.colYs;
        } else {
          // brick spans more than one column
          // how many different places could this brick fit horizontally
          groupCount = this.cols + 1 - colSpan;
          colGroup = [];

          // for each group potential horizontal position
          for ( j=0; j < groupCount; j++ ) {
            // make an array of colY values for that one group
            groupColY = this.colYs.slice( j, j + colSpan );
            // and get the max value of the array
            colGroup[j] = Math.max.apply( Math, groupColY );
          }

        }

        this._placeBrick( brick, colGroup );
      }

      // set the size of the container
      var containerWidth = {};
      this.element.style.height = Math.max.apply( Math, this.colYs ) + 'px';
      if ( this.options.isFitWidth ) {
        var unusedCols = 0;
        i = this.cols;
        // count unused columns
        while ( --i ) {
          if ( this.colYs[i] !== 0 ) {
            break;
          }
          unusedCols++;
        }
        // fit container to columns that have been used;
        this.element.style.width = ( (this.cols - unusedCols) * this.columnWidth -
          this.options.gutterWidth ) + 'px';
      }

      // provide bricks as context for the callback
      if ( callback ) {
        callback.call( bricks );
      }

      this.isLaidOut = true;
    },

    _placeBrick: function( brick, setY ) {
      // get the minimum Y value from the columns
      var minimumY = Math.min.apply( Math, setY ),
          shortCol = 0;

      // Find index of short column, the first from the left
      for ( var i=0, len = setY.length; i < len; i++ ) {
        if ( setY[i] === minimumY ) {
          shortCol = i;
          break;
        }
      }

      // position the brick
      brick.style.top = ( minimumY + this.offset.y ) + 'px';
      brick.style[ this.horizontalDirection ] = ( this.columnWidth * shortCol + this.offset.x ) + 'px';

      // apply setHeight to necessary columns
      var setHeight = minimumY + getWH( brick, 'height', true ),
          setSpan = this.cols + 1 - len;
      for ( i=0; i < setSpan; i++ ) {
        this.colYs[ shortCol + i ] = setHeight;
      }

    },

    // ====================== resize ======================

    resize: function() {
      var prevColCount = this.cols;
      // get updated colCount
      this._getColumns();
      if ( this.isFluid || this.cols !== prevColCount ) {
        // if column count has changed, trigger new layout
        this._reLayout();
      }
    },

    // ====================== methods ======================

    // for prepending
    reload: function( callback ) {
      this.reloadItems();
      this.build( callback );
    },

    // convienence method for working with Infinite Scroll
    appended: function( items, isAnimatedFromBottom, callback ) {
      var instance = this,
          layoutAppendedItems = function() {
            instance._appended( items, callback );
          };

      if ( isAnimatedFromBottom ) {
        // set new stuff to the bottom
        var y = getWH( this.element, 'height' ) + 'px';
        for (var i=0, len = items.length; i < len; i++) {
          items[i].style.top = y;
        }
        // layout items async after initial height has been set
        setTimeout( layoutAppendedItems, 1 );
      } else {
        layoutAppendedItems()
      }
    },

    _appended: function( items, callback ) {
      // add new bricks to brick pool
      this._getBricks( items );
      this.layout( items, callback );
    },

    destroy: function() {
      var brick;
      for (var i=0, len = this.bricks.length; i < len; i++) {
        brick = this.bricks[i];
        brick.style.position = '';
        brick.style.top = '';
        brick.style.left = '';
        removeClass( brick, 'masonry-brick' );
      }

      // re-apply saved container styles
      var elemStyle = this.element.style;
      len = masonryContainerStyles.length;
      for ( i=0; i < len; i++ ) {
        var prop = masonryContainerStyles[i];
        elemStyle[ prop ] = this._originalStyle[ prop ];
      }

      removeClass( this.element, 'masonry' );

      if ( this.resizeHandler ) {
        removeEvent( window, 'resize', this.resizeHandler );
      }

    }

  };

  window.Masonry = Masonry;

})( window );
