/**
 * jquery.datepicker
 *
 * @author xiaomi
 * @update 2015.04.21
 */

(function(factory) {
    if(typeof define === 'function' && define.amd) {
        define(['jquery', 'module'], factory);
    }
    else {
        factory(jQuery);
    }
}(function($, module) {
    var view = $(window);
    var doc = $(document);
    var slice = Array.prototype.slice;
    var RE_INPUT = /^(?:input|textarea)$/i;

    function Datepicker(options) {
        this.init(options);
    }

    var defaultOptions = {
        autoclose: true,
        format: 'yyyy-MM-dd',
        todayHighlight: true,
        endDate: new Date(9999, 12, 31),
        startDate: 0,

        // dom
        syncValue: true,

        // layout
        zIndex: null,
        size: 'normal',
        orientation: 'auto',
        orientationOffset: [0, 4],
        timepicker: false,
        minViewMode: 0, // 0 - 月, 1 - 年, 2 - 10年
        startView: 0,

        // langs
        langs: {
            year: '年',
            month: '月',
            today: '今天',
            weeks: ['日', '一', '二', '三', '四', '五', '六']
        },

        // events
        onchange: $.noop,
        onshow: $.noop,
        onhide: $.noop,

        // hooks
        hooks: 'jquery.datepicker.hooks'
    };

    $.extend(Datepicker.prototype, {
        modes: ['Day', 'Month', 'Year'],
        init: function(ops) {
            this.options = ops || (ops = {});

            $.each(Datepicker.defaultOptions, function(k, val) {
                if(typeof ops[k] === 'undefined') {
                    ops[k] = val;
                }
            });

            // orientation
            var plc = ops.orientation.split(' ');
            var orientation = ops.orientation = {
                x: 'auto',
                y: 'auto'
            };

            if(plc[0] && /(left|right)/.test(plc[0])) {
                orientation.x = RegExp.$1;
            }

            if(plc[1] && /(top|bottom)/.test(plc[1])) {
                orientation.y = RegExp.$1;
            }

            var target = this.target = $(ops.target);
            var nodeName = target.prop('nodeName');
            this.isInput = RE_INPUT.test(nodeName);

            this.setStartDate(ops.startDate);
            this.setEndDate(ops.endDate);
            this.initEvent();
            this.update();
        },
        getShell: function() {
            var shell = this.shell;
            if(shell) {
                return shell;
            }

            var ops = this.options;
            shell = document.createElement('div');
            // shell.id = this.id;
            // shell.tabIndex = -1;

            var className = 'ui-datepicker datepicker dropdown-menu';
            if(ops.size !== 'normal') {
                className += ' datepicker-' + ops.size;
            }
            if(ops.className) {
                className += ' ' + ops.className;
            }

            shell.className = className;
            shell.setAttribute('role', 'dialog');
            shell.style.cssText = 'position:absolute;opacity:0';

            var html = Datepicker.template;
            html = html.replace('{timepicker}', ops.timepicker ? Datepicker.timepickerTemplate : '');
            shell.innerHTML = html;

            shell = this.shell = $(shell);
            this.daysShell = shell.find('.datepicker-days').eq(0);
            this.yearsShell = shell.find('.datepicker-years').eq(0);
            this.monthsShell = shell.find('.datepicker-months').eq(0);
            this.timesShell = shell.find('.timepicker').eq(0);

            if(ops.timepicker) {
                this.minutesInput = this.timesShell.find('.minute-input input');
                this.hoursInput = this.timesShell.find('.hour-input input');
                this.timesShell.show().parent().show();
            }

            var events = this.events;

            // choose
            shell.delegate('.day,.month,.year', 'click', events.itemClick);

            // switch
            shell.delegate('.datepicker-switch,.next,.prev', 'click', events.dateSwitchClick);

            // timepicker
            if(ops.timepicker) {
                shell.delegate('.hour,.minute', 'click', events.itemClick);
                shell.delegate('.picker-btn', 'click', events.timeSwitchClick);

                // time input
                var timeInputEventTimer;
                var timeInpus = shell.find('.minute-input input, .hour-input input');

                timeInpus.on('change input propertychange', function(e) {
                    clearTimeout(timeInputEventTimer);
                    timeInputEventTimer = setTimeout(function() {
                        var target = e.target;
                        var val = $.trim(target.value);

                        if(!val || !target.offsetWidth) {
                            return;
                        }

                        events.timeInput.call(e.target, e);
                    }, 0);
                });

                timeInpus.on('keydown', events.keydown);
            }

            // click for focus
            shell.on('click', events.click);

            return shell;
        },
        initEvent: function() {
            var self = this;
            var ops = this.options;
            var target = this.target;

            var events = this.events = {
                show: function() {
                    if(!self.opened) {
                        self.update();
                        self.show();
                    }
                },
                hide: function() {
                    self.hide();
                },
                hideClick: function(e) {
                    var elem = e.target;
                    var shell = self.shell;

                    if(
                        !elem.parentNode ||
                        target.is(elem) ||
                        target.find(elem).length ||
                        shell.is(elem) ||
                        shell.find(elem).length
                    ) {
                        return;
                    }

                    $(this).off('click.datepicker', events.hideClick);
                    self.hide();
                },
                blur: function(e) {
                    self.lastFocusElem = e.target;
                },
                resize: function() {
                    self.position();
                },
                click: function(e) {
                    // last focused
                    if(
                        self.opened && self.lastFocusElem &&
                        !RE_INPUT.test(e.target.nodeName)
                    ) {
                        try {
                            self.lastFocusElem.focus();
                        }
                        catch(_){}
                    }

                    delete self.lastFocusElem;
                },
                itemClick: function() {
                    var className = this.className;
                    if(className.indexOf('disabled') > -1) {
                        return;
                    }

                    var targetMonth;
                    var viewMode = 0;
                    var date = self.chooseDate;
                    var isChooseDay = className.indexOf('day') > -1;
                    var val = parseInt(this.getAttribute('data-value'), 10) || 0;

                    if(isChooseDay && className.indexOf('old') > -1) {
                        targetMonth = date.getMonth() - 1;
                        date.setMonth(targetMonth);
                    }
                    else if(isChooseDay && className.indexOf('new') > -1) {
                        targetMonth = date.getMonth() + 1;
                        date.setMonth(targetMonth);
                    }

                    if(isChooseDay) {
                        date.setDate(val);
                    }
                    else if(className.indexOf('year') > -1) {
                        date.setFullYear(val);
                        viewMode = 2;
                    }
                    else if(className.indexOf('month') > -1) {
                        targetMonth = val - 1;
                        date.setMonth(targetMonth);
                        viewMode = 1;
                    }
                    else if(className.indexOf('hour') > -1) {
                        date.setHours(val);
                        viewMode = -1;
                    }
                    else if(className.indexOf('minute') > -1) {
                        date.setMinutes(val);
                        viewMode = -1;
                    }

                    // make sure month correct
                    if(isFinite(targetMonth)) {
                        targetMonth = (12 + targetMonth) % 12;

                        if(targetMonth !== date.getMonth()) {
                            date.setMonth(targetMonth);
                        }
                    }

                    self.setDate(date);

                    var modeName;
                    var modes = self.modes;

                    if(viewMode < 0) {
                        self.fillTimes();
                        return;
                    }
                    else if(!viewMode || viewMode <= ops.minViewMode) {
                        if(ops.autoclose) {
                            self.hide();
                        }
                        else {
                            modeName = modes[viewMode];
                            self['fill'+ modeName + 's']();
                        }

                        return;
                    }

                    modeName = modes[viewMode - 1];
                    if(modeName) {
                        self['show'+ modeName +'sPanel']();
                    }
                },
                dateSwitchClick: function() {
                    var className = this.className;
                    if(className.indexOf('disabled') > -1) {
                        return;
                    }

                    var targetPanel = 'Years';
                    var daysShell = self.daysShell;
                    var monthsShell = self.monthsShell;

                    if(daysShell.find(this).length) {
                        targetPanel = 'Days';
                    }
                    else if(monthsShell.find(this).length) {
                        targetPanel = 'Months';
                    }

                    if(
                        className.indexOf('switch') > -1 &&
                        targetPanel !== 'Years'
                    ) {
                        self['show' + (targetPanel==='Days'?'Months':'Years') + 'Panel']();
                        return;
                    }

                    var isNext = className.indexOf('next') > -1;
                    if(isNext || className.indexOf('prev') > -1) {
                        var date = self.chooseDate;
                        var offset = isNext ? 1 : -1;

                        if(targetPanel === 'Days') {
                            date.setMonth(date.getMonth() + offset);
                            self.fillDays(date);
                        }
                        else if(targetPanel === 'Months') {
                            date.setFullYear(date.getFullYear() + offset);
                            self.fillMonths(date);
                        }
                        else {
                            date.setFullYear(date.getFullYear() + 12*offset);
                            self.fillYears(date);
                        }
                    }
                },
                timeSwitchClick: function() {
                    var className = this.className;
                    if(className.indexOf('disabled') > -1) {
                        return;
                    }

                    var type = this.parentNode.getAttribute('data-role');
                    var isNext = className.indexOf('up') < 0;

                    var val = isNext ? 1 : -1;
                    var method = 'setMinutes';
                    if(type === 'hour') {
                        method = 'setHours';

                        val += 24 + self.getHours();
                        val %= 24;
                    }
                    else {
                        val += 60 + self.getMinutes();
                        val %= 60;
                    }

                    self[method](val);
                    self.fillTimes();
                },
                timeInput: function() {
                    var maxVal = this.name === 'hour' ? 23 : 59;
                    var val = parseInt(this.value, 10) || 0;
                    val = Math.max(0, Math.min(maxVal, val));

                    var date = self.chooseDate;
                    var oldMs = +date;

                    if(this.name === 'hour') {
                        date.setHours(val);
                    }
                    else {
                        date.setMinutes(val);
                    }

                    if(oldMs !== +date) {
                        self.setDate(date);
                        self.fillTimes();
                    }
                },
                keydown: function(e) {
                    var fn = keyFnsMap[e.keyCode];

                    if(fn) {
                        fn.call(self, e);
                    }
                }
            };

            var hideFn = function() {
                self.hide();
            };

            var keyFnsMap = {
                '27': hideFn,
                '13': hideFn,
                '8': function(e) {
                    // prevent backspace key
                    if(target[0] === e.target && target.prop('readOnly')) {
                        e.preventDefault();
                    }
                },
                '9': function(e) {
                    var shell = this.shell;
                    if($.contains(shell[0], e.target)) {
                        return;
                    }

                    this.hide();
                },
                // key up
                '38': function(e) {
                    var inp = e.target;
                    var oldVal = parseInt(inp.value, 10) || 0;
                    var maxVal = inp.name === 'hour' ? 23 : 59;
                    var val = Math.max(0, Math.min(maxVal, oldVal + 1));

                    if(val !== oldVal) {
                        inp.value = val;
                        $.event.trigger('input', null, inp);
                    }
                },
                // key down
                '40': function(e) {
                    var inp = e.target;
                    var oldVal = parseInt(inp.value, 10) || 0;
                    var maxVal = inp.name === 'hour' ? 23 : 59;
                    var val = Math.max(0, Math.min(maxVal, oldVal - 1));

                    if(val !== oldVal) {
                        inp.value = val;
                        $.event.trigger('input', null, inp);
                    }
                }
            };

            target.on('click.datepicker focus.datepicker', events.show)
            // .delegate('*', 'blur.datepicker', events.blur)
            .on('keydown.datepicker', events.keydown)
            .on('blur.datepicker', events.blur);
        },
        opened: false,
        show: function() {
            var shell = this.getShell();

            if(!this.opened) {
                if(Datepicker.lastActivedPicker) {
                    Datepicker.lastActivedPicker.hide();
                }
                Datepicker.lastActivedPicker = this;

                this.chooseDate = Datepicker.parseDate(this.date);
                this.opened = true;

                var ops = this.options;
                var modeInx = ops.startView % this.modes.length;
                modeInx = Math.max(ops.minViewMode, modeInx);

                var modeName = this.modes[modeInx];
                this['show'+ modeName +'sPanel']();

                shell.css({
                    display: 'block',
                    opacity: 1
                })
                .appendTo('body');

                var events = this.events;
                if(ops.autoclose) {
                    doc.on('click.datepicker', events.hideClick);
                }

                view.on('resize.datepicker', events.resize);

                this._trigger('show');
            }

            return this.position();
        },
        hide: function() {
            if(this.opened) {
                this.shell.hide().detach();
                this.chooseDate = null;
                this.opened = false;

                if(this === Datepicker.lastActivedPicker) {
                    Datepicker.lastActivedPicker = null;
                }

                var events = this.events;
                doc.off('click.datepicker', events.hideClick);
                view.off('resize.datepicker', events.resize);

                this._trigger('hide');
            }

            return this;
        },
        getFillData: function(date) {
            var langs = this.options.langs;
            var itemTmpl = '<span class="{className}" data-value="{value}">';
            var monthTmpl = itemTmpl + '{month}'+ langs.month +'</span>';
            var yearTmpl = itemTmpl + '{year}' +'</span>';

            var startDate = this.startDate;
            var endDate = this.endDate;

            return {
                yearTmpl: yearTmpl,
                monthTmpl: monthTmpl,
                dayTmpl: '<td class="{className}" data-value="{value}"><b>{day}</b></td>',
                minuteTmpl: '<span class="minute" data-value="{value}">{minute}</span>',
                hourTmpl: '<span class="hour" data-value="{value}">{hour}</span>',
                date: Datepicker.parseDate(date || this.date),
                minYear: startDate.getFullYear(),
                minMonth: startDate.getMonth(),
                minDay: startDate.getDate(),
                maxYear: endDate.getFullYear(),
                maxMonth: endDate.getMonth(),
                maxDay: endDate.getDate(),
                minMs: +startDate,
                maxMs: +endDate
            };
        },
        fillWeeks: function() {
            // week label
            var html = '';
            $.each(this.options.langs.weeks, function(i, w) {
                html += '<td class="dow">'+ w +'</td>';
            });

            var weekLabel = this.daysShell.find('.week-content');
            weekLabel.html(html);

            this.weeksFilled = true;
        },
        getDayClassName: function(date) {
            var format = 'yyyy-MM-dd';
            var activeDay = Datepicker.formatDate(this.date, format);
            var formattedDay = Datepicker.formatDate(date, format);
            var today = Datepicker.formatDate(new Date(), format);

            var ms = +date;
            var className = 'day';

            if(formattedDay === today) {
                className += ' today';
            }

            // fit min/max date
            var maxDate = this.endDate;
            var minDate = this.startDate;
            minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
            maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59);

            if(ms < +minDate || ms > +maxDate) {
                className += ' disabled';
                return className;
            }

            var ratio = 100;
            var chooseDate = this.chooseDate;
            var dateNum = ratio * date.getFullYear() +
                date.getMonth();
            var currDateNum = ratio * chooseDate.getFullYear() +
                chooseDate.getMonth();

            if(formattedDay === activeDay) {
                className += ' active';
            }
            else if(dateNum !== currDateNum) {
                className += dateNum > currDateNum ? ' new' : ' old';
            }

            // range
            var range = this.range;
            var rangeMap = this.rangeMap;
            if(range && rangeMap) {
                if(ms >= range[0].dateMs && ms <= range[range.length - 1].dateMs) {
                    className += ' range';
                }
                if(rangeMap[formattedDay]) {
                    className += ' selected';
                }
            }

            return className;
        },
        fillDays: function(date) {
            var ops = this.options;
            var langs = ops.langs;

            var daysShell = this.daysShell;
            var fillData = this.getFillData(date);
            date = fillData.date;

            // picker label
            var format = 'yyyy' + langs.year + 'M' + langs.month;
            var pickerTxt = Datepicker.formatDate(date, format);
            daysShell.find('.datepicker-switch').html(pickerTxt);

            if(!this.weeksFilled) {
                this.fillWeeks();
            }

            // weekDay
            date.setDate(-1);

            var firstWeekDay = date.getDay();
            if(firstWeekDay > 0) {
                date.setDate(date.getDate() - firstWeekDay);
            }

            // days
            var i = 1;
            var c = 6 * 7;
            var startMs = +date;

            html = '<tr>';
            for(var extData, className, dayStr, day = date.getDate(); i<=c; ++i) {
                date.setDate(day);
                day = date.getDate();

                className = this.getDayClassName(date, fillData);

                dayStr = day;
                if(ops.todayHighlight && className.indexOf('today') > -1) {
                    dayStr = langs.today;
                }

                extData = Datepicker.runHook('day', date, fillData);
                if(extData.className) {
                    className += ' ' + extData.className;
                }
                if(extData.content) {
                    dayStr += extData.content;
                }

                html += fill(fillData.dayTmpl, {
                    className: className,
                    day: dayStr,
                    value: day
                });

                if(i % 7 <= 0) {
                    html += '</tr><tr>';
                }

                day++;
            }
            html += '</tr>';

            daysShell.find('tbody').html(html);

            var prevBtn = daysShell.find('.prev');
            var isMinOverflowed = startMs <= fillData.minMs;
            prevBtn[isMinOverflowed ? 'addClass' : 'removeClass']('disabled');

            var nextBtn = daysShell.find('.next');
            var isMaxOverflowed = +date >= fillData.maxMs;
            nextBtn[isMaxOverflowed ? 'addClass' : 'removeClass']('disabled');

            if(ops.timepicker) {
                this.fillTimes();
            }
        },
        showDaysPanel: function() {
            this.monthsShell.hide();
            this.yearsShell.hide();

            this.fillDays();
            this.daysShell.show();
        },
        fillMonths: function(date) {
            var langs = this.options.langs;
            var monthsShell = this.monthsShell;
            var fillData = this.getFillData(date);
            date = fillData.date;

            // picker label
            var pickerTxt = date.getFullYear() + langs.year;
            monthsShell.find('.datepicker-switch').html(pickerTxt);

            // months
            var html = '';
            var format = 'yyyy-MM';
            var startYear = date.getFullYear();
            var activeMonth = Datepicker.formatDate(this.date, format);

            for(var className, year, fmonth, month = 0; month < 12; ++month) {
                date.setMonth(month);
                year = date.getFullYear();
                fmonth = Datepicker.formatDate(date, format);

                className = 'month';
                if(fmonth === activeMonth) {
                    className += ' active';
                }

                if(
                    (year <= fillData.minYear && month < fillData.minMonth) ||
                    (year >= fillData.maxYear && month > fillData.maxMonth)
                ) {
                    className += ' disabled';
                }

                html += fill(fillData.monthTmpl, {
                    className: className,
                    month: month + 1,
                    value: month + 1
                });
            }

            monthsShell.find('tbody td').html(html);

            var prevBtn = monthsShell.find('.prev');
            var isMinOverflowed = startYear <= fillData.minYear;
            prevBtn[isMinOverflowed ? 'addClass' : 'removeClass']('disabled');

            var nextBtn = monthsShell.find('.next');
            var isMaxOverflowed = date.getFullYear() >= fillData.maxYear;
            nextBtn[isMaxOverflowed ? 'addClass' : 'removeClass']('disabled');
        },
        showMonthsPanel: function() {
            this.yearsShell.hide();
            this.daysShell.hide();

            this.fillMonths();
            this.monthsShell.show();
        },
        fillYears: function(date) {
            var yearsShell = this.yearsShell;
            var fillData = this.getFillData(date);
            date = fillData.date;

            var activeYear = this.date.getFullYear();
            var currYear = date.getFullYear();
            var minYear = currYear - 5;
            var maxYear = currYear + 6;

            // picker label
            var pickerTxt = minYear + ' - ' + maxYear;
            yearsShell.find('.datepicker-switch').html(pickerTxt);

            var html = '';
            for(var className, year=minYear; year<=maxYear; ++year) {
                className = 'year';
                if(year === activeYear) {
                    className += ' active';
                }

                if(year < fillData.minYear || year > fillData.maxYear) {
                    className += ' disabled';
                }

                html += fill(fillData.yearTmpl, {
                    className: className,
                    value: year,
                    year: year
                });
            }

            yearsShell.find('tbody td').html(html);

            var prevBtn = yearsShell.find('.prev');
            var isMinOverflowed = minYear <= fillData.minYear;
            prevBtn[isMinOverflowed ? 'addClass' : 'removeClass']('disabled');

            var nextBtn = yearsShell.find('.next');
            var isMaxOverflowed = maxYear >= fillData.maxYear;
            nextBtn[isMaxOverflowed ? 'addClass' : 'removeClass']('disabled');
        },
        showYearsPanel: function() {
            this.monthsShell.hide();
            this.daysShell.hide();

            this.fillYears();
            this.yearsShell.show();
        },
        fillTimes: function(date) {
            var timesShell = this.timesShell;
            var fillData = this.getFillData(date);
            date = fillData.date;

            // hours
            var currHour = date.getHours();
            var oldHourVal = parseInt(this.hoursInput.val(), 10) || 0;
            if(currHour !== oldHourVal) {
                this.hoursInput.val(Datepicker.padNumber(currHour, 2));
            }

            var html = '';
            var minHour = currHour - 2;
            var maxHour = currHour + 2;

            for(var h=minHour; minHour<=maxHour; ++minHour) {
                h = (minHour + 24) % 24;

                html += fill(fillData.hourTmpl, {
                    hour: Datepicker.padNumber(h, 2),
                    value: h
                });
            }
            timesShell.find('.picker-innercon-hours').html(html);

            // minutes
            var currMinute = date.getMinutes();
            var oldMinuteVal = parseInt(this.minutesInput.val(), 10) || 0;
            if(currMinute !== oldMinuteVal) {
                this.minutesInput.val(Datepicker.padNumber(currMinute, 2));
            }

            html = '';
            var minMinute = currMinute - 2;
            var maxMinute = currMinute + 2;

            for(var m; minMinute<=maxMinute; ++minMinute) {
                m = (minMinute + 60) % 60;

                html += fill(fillData.minuteTmpl, {
                    minute: Datepicker.padNumber(m, 2),
                    value: m
                });
            }
            timesShell.find('.picker-innercon-minutes').html(html);
        },
        position: function() {
            var ops = this.options;
            var target = this.target;
            var shell = this.getShell();

            // zIndex
            var zIndex = ops.zIndex;
            if(!zIndex || zIndex === 'auto') {
                var tmpParent = target[0];
                var rRoot = /html|body/i;

                while(tmpParent &&
                    tmpParent.offsetParent &&
                    !rRoot.test(tmpParent.offsetParent.nodeName)
                ) {
                    tmpParent = tmpParent.offsetParent;
                }

                zIndex = $(tmpParent).css('zIndex');
                zIndex = 10 + (parseInt(zIndex, 10) || 0);
            }

            var offset = target.offset();
            var width = target.outerWidth();
            var height = target.outerHeight();
            var shellWidth = shell.outerWidth();
            var shellHeight = shell.outerHeight();

            shell.removeClass(
                'datepicker-orient-top datepicker-orient-bottom ' +
                'datepicker-orient-right datepicker-orient-left'
            );

            var className = '';
            var top = offset.top;
            var left = offset.left;
            var topOffset = ops.orientationOffset[1] || 0;
            var leftOffset = ops.orientationOffset[0] || 0;
            var orientation = ops.orientation;
            var visualPad = 6;

            // left, right
            left += leftOffset;
            if(orientation.x === 'auto') {
                className += 'datepicker-orient-left';

                var viewWidth = view.width();
                if(left + shellWidth > viewWidth) {
                    left = viewWidth - shellWidth - visualPad;
                }
            }
            else {
                className += 'datepicker-orient-' + orientation.x;

                if(orientation.x === 'right') {
                    left -= shellWidth - width;
                }
            }

            // top, bottom
            var yorient = orientation.y;
            if(orientation.y === 'auto') {
                var viewHeight = view.height();
                var scrollTop = view.scrollTop();
                var topOverflow = top - scrollTop;
                var bottomOverflow = scrollTop + viewHeight - top - height;

                yorient = 'top';
                if(bottomOverflow < topOverflow) {
                    yorient = 'bottom';
                }
            }

            if(yorient === 'top') {
                top += height + topOffset;
            }
            else {
                top -= shellHeight + topOffset;
            }

            className += 'datepicker-orient-' + yorient;

            shell.addClass(className)
            .css({
                zIndex: zIndex,
                left: left,
                top: top
            });

            return this;
        },
        destroy: function() {
            this.hide();
            this.shell.remove();

            this.target.off('.datepicker')
                .removeData('datepicker');
        }
    });

    // date & time
    $.extend(Datepicker.prototype, (function() {
        var dateFns = {
            syncValue: function() {
                var date = this.date;
                var ops = this.options;
                var target = this.target;

                if(ops.syncValue && target.length) {
                    var formattedDate = Datepicker.formatDate(date, ops.format);
                    var method = this.isInput ? 'val' : 'html';
                    var oldVal = target[method]();

                    if(!oldVal || formattedDate !== oldVal) {
                        target[method](formattedDate);
                    }
                }
            },
            update: function(date) {
                var ops = this.options;
                var target = this.target;

                if(!date && ops.syncValue) {
                    date = target[this.isInput ? 'val' : 'html']();
                }

                if(!this.date) {
                    this.date = new Date();
                }

                var format = this.options.format;
                date = Datepicker.parseDate(date || this.date, format);

                var minMs = this.startDate.getTime();
                var maxMs = this.endDate.getTime();
                var ms = date.getTime();

                if(ms > maxMs) {
                    ms = maxMs;
                    date = new Date(ms);
                }
                if(ms < minMs) {
                    ms = minMs;
                    date = new Date(ms);
                }

                var currMs = this.date.getTime();
                if(ms !== currMs) {
                    this.date = date;
                    this.syncValue();
                }

                return this;
            },
            setDate: function(date) {
                var oldMs = this.date.getTime();
                this.update(date);

                var hasChanged = false;
                var currMs = this.date.getTime();
                if(currMs !== oldMs) {
                    hasChanged = true;
                }

                if(!hasChanged) {
                    var method = this.isInput ? 'val' : 'html';
                    if(!this.target[method]()) {
                        hasChanged = true;
                        this.syncValue();
                    }
                }

                if(hasChanged) {
                    this._trigger('change');
                }

                return this;
            },
            getDate: function() {
                return this.date;
            },
            getFormattedDate: function(format) {
                if(!format) {
                    format = this.options.format;
                }

                var date = this.getDate();
                return Datepicker.formatDate(date, format);
            },
            setStartDate: function(date) {
                var startDate = Datepicker.parseDate(date, this.options.format);
                this.startDate = startDate;

                if(+startDate > +this.date) {
                    this.setDate(startDate);
                }

                return this;
            },
            setEndDate: function(date) {
                var endDate = Datepicker.parseDate(date, this.options.format);
                this.endDate = endDate;

                if(+endDate < +this.date) {
                    this.setDate(endDate);
                }

                return this;
            },
            setRange: function(range) {
                if(!range || !range.length) {
                    delete this.rangeMap;
                    delete this.range;
                    return this;
                }

                var dayFormat = 'yyyy-MM-dd';
                var format = this.options.format;

                range = this.range = $.map(range, function(date) {
                    date = Datepicker.parseDate(date, format);

                    return {
                        date: date,
                        dateMs: +date,
                        formattedDay: Datepicker.formatDate(date, dayFormat)
                    };
                });

                range.sort(function(a, b) {
                    return a.dateMs - b.dateMs;
                });

                var rangeMap = this.rangeMap = {};
                $.each(range, function(i, item) {
                    rangeMap[item.formattedDay] = true;
                });

                return this;
            }
        };

        var fnsMap = {
            Year: ['FullYear'],
            Month: ['Month', -1],
            Day: ['Date'],
            Hours: ['Hours'],
            Minutes: ['Minutes'],
            Seconds: ['Seconds']
        };

        $.each(fnsMap, function(k, fn) {
            var offset = fn[1] || 0;
            fn = fn[0];

            dateFns['set' + k] = function(val) {
                val = parseInt(val, 10);

                var date = new Date(+this.date);
                date['set' + fn](val + offset);

                return this.setDate(date);
            };

            dateFns['get' + k] = function() {
                var val = this.date['get' + fn]();

                return val - offset;
            };
        });

        return dateFns;
    })());

    // Event
    $.extend(Datepicker.prototype, {
        on: function() {
            var args = [].slice.call(arguments);
            args.unshift(this);

            $.event.add.apply($.event, args);
            return this;
        },
        off: function() {
            var args = [].slice.call(arguments);
            args.unshift(this);

            $.event.off.apply($.event, args);
            return this;
        },
        trigger: function(evt, data) {
            if(!(evt instanceof $.Event)) {
                evt = new $.Event(evt);
            }
            $.event.trigger(evt, data, this, true);

            var ops = this.options;
            if(ops && $.isFunction(ops['on' + evt.type]) &&
                ops['on' + evt.type].call(this, evt, data) === false
            ) {
                evt.preventDefault();
            }

            return evt;
        },
        _trigger: function(type) {
            var ops = this.options;
            var date = this.getDate();
            var formattedDate = Datepicker.formatDate(date, ops.format);

            var evtData = {
                date: date,
                formattedDate: formattedDate
            };

            this.trigger($.Event(type, evtData));

            evtData.type = type;
            this.target.trigger(evtData);
        }
    });

    // Utils
    $.extend(Datepicker, (function() {
        var DATE_FORMATS_SPLIT = /((?:[^yMdHhmsaZEw']+)|(?:'(?:[^']|'')*')|(?:E+|y+|M+|d+|H+|h+|m+|s+|a|Z|w+))(.*)/;

        function concat(array1, array2, index) {
            return array1.concat(slice.call(array2, index));
        }

        function padNumber(num, digits, trim) {
            var neg = '';
            if (num < 0) {
                neg = '-';
                num = -num;
            }

            num = '' + num;
            while(num.length < digits){
                num = '0' + num;
            }

            if(trim) {
                num = num.substr(num.length - digits);
            }

            return neg + num;
        }

        function dateGetter(name, size, offset, trim) {
            offset = offset || 0;

            return function(date) {
                var value = date['get' + name]();

                if(offset > 0 || value > -offset) {
                    value += offset;
                }

                if(value === 0 && offset == -12) {
                    value = 12;
                }

                return padNumber(value, size, trim);
            };
        }

        function dateStrGetter(name, shortForm) {
            return function(date, formats) {
                var value = date['get' + name]();
                var get = (shortForm ? ('SHORT' + name) : name).toUpperCase();

                return formats[get][value];
            };
        }

        var DATETIME_FORMATS = {
            // MONTH: 'January,February,March,April,May,June,July,August,September,October,November,December'.split(','),
            MONTH: '一月,二月,三月,四月,五月,六月,七月,八月,九月,十月,十一月,十二月'.split(','),
            SHORTMONTH: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(','),
            // DAY: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday'.split(','),
            // SHORTDAY: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat'.split(','),
            DAY: [],
            SHORTDAY: [],
            AMPMS: ['AM', 'PM'],
            medium: 'MMM d, y h:mm:ss a',
            'short': 'M/d/yy h:mm a',
            fullDate: 'EEEE, MMMM d, y',
            longDate: 'MMMM d, y',
            mediumDate: 'MMM d, y',
            shortDate: 'M/d/yy',
            mediumTime: 'h:mm:ss a',
            shortTime: 'h:mm a'
        };

        // for cn-zh
        String('日,一,二,三,四,五,六').replace(/[^,]+/g, function(a) {
            DATETIME_FORMATS.SHORTDAY.push('周' + a);

            // if(a === '日') {
            //     a = '天';
            // }
            DATETIME_FORMATS.DAY.push('星期' + a);
        });

        var DATE_FORMATS = {
            yyyy: dateGetter('FullYear', 4),
            yy: dateGetter('FullYear', 2, 0, true),
            y: dateGetter('FullYear', 1),
            MMMM: dateStrGetter('Month'),
            MMM: dateStrGetter('Month', true),
            MM: dateGetter('Month', 2, 1),
            M: dateGetter('Month', 1, 1),
            dd: dateGetter('Date', 2),
            d: dateGetter('Date', 1),
            HH: dateGetter('Hours', 2),
            H: dateGetter('Hours', 1),
            hh: dateGetter('Hours', 2, -12),
            h: dateGetter('Hours', 1, -12),
            mm: dateGetter('Minutes', 2),
            m: dateGetter('Minutes', 1),
            ss: dateGetter('Seconds', 2),
            s: dateGetter('Seconds', 1),
            // while ISO 8601 requires fractions to be prefixed with `.` or `,`
            // we can be just safely rely on using `sss` since we currently don't support single or two digit fractions
            sss: dateGetter('Milliseconds', 3),
            EEEE: dateStrGetter('Day'),
            EEE: dateStrGetter('Day', true)
            //  a: ampmGetter,
            //  Z: timeZoneGetter,
            // ww: weekGetter(2),
            //  w: weekGetter(1)
        };

        // for parser
        var formatCache = {};
        var rValidParts = /yy(?:yy)|MM?|dd?|HH?|hh?|mm?|ss?/g;
        var rNonpunctuation = /[^ -\/:-@\[\u3400-\u9fff-`{-~\t\n\r]+/g;
        var parseFns = {};

        var parseFnsMap = {
            yy: ['FullYear'],
            MM: ['Month', -1],
            dd: ['Date'],
            HH: ['Hours'],
            hh: ['Hours', 12],
            mm: ['Minutes'],
            ss: ['Seconds']
        };
        $.each(parseFnsMap, function(k, fn) {
            var offset = fn[1] || 0;
            fn = fn[0];

            parseFns[k] = function(date, val) {
                date['set' + fn](val + offset);
            };

            var sk = k.slice(0, 1);
            if(sk) {
                parseFns[sk] = parseFns[k];
            }
        });
        parseFns.yyyy = parseFns.yy;

        // for date coverter
        var timezoneFns = {
            UTC: function(date) {
                return date.getMinutes() + date.getTimezoneOffset();
            },
            Locale: function(date) {
                return date.getMinutes() - date.getTimezoneOffset();
            }
        };

        function getTimezoneCoverter(tzFn) {
            return function(date, format) {
                date = Datepicker.parseDate(date, format);

                var minutes = date.getMinutes();
                if(timezoneFns[tzFn]) {
                    minutes = timezoneFns[tzFn](date);
                }
                else if($.isNumeric(tzFn)) {
                    minutes += tzFn;
                }

                date.setMinutes(minutes);

                if(format) {
                    return Datepicker.formatDate(date, format);
                }

                return date;
            };
        }

        return {
            DATE_FORMATS: DATE_FORMATS,
            DATETIME_FORMATS: DATETIME_FORMATS,

            // follow angular
            // https://github.com/angular/angular.js/blob/master/src/ng/filter/filters.js#L221
            formatDate: function(date, format, timezone) {
                if(typeof date === 'number') {
                    date = new Date(date);
                }

                format = format || 'yyyy-MM-dd';

                var match, parts = [];
                while(format) {
                    match = DATE_FORMATS_SPLIT.exec(format);
                    if(match) {
                        parts = concat(parts, match, 1);
                        format = parts.pop();
                    }
                    else {
                        parts.push(format);
                        format = null;
                    }
                }

                if(timezone && timezone === 'UTC') {
                    date = new Date(date.getTime());
                    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
                }

                var fn, text = '';
                $.each(parts, function(i, value) {
                    fn = DATE_FORMATS[value];

                    text += fn ? fn(date, DATETIME_FORMATS) :
                        value.replace(/(^'|'$)/g, '').replace(/''/g, "'");
                });

                return text;
            },
            parseFormat: function(format) {
                if(formatCache[format]) {
                    return formatCache[format];
                }

                var spliter = '\0';
                var parts = format.match(rValidParts);

                if(!parts || !parts.length) {
                    throw new Error('Invalid date format.');
                }

                var separators = format.replace(rValidParts, spliter)
                    .split(spliter);

                formatCache[format] = {
                    separators: separators,
                    parts: parts
                };

                return formatCache[format];
            },
            parseDate: function(input, format) {
                if($.isNumeric(input)) {
                    return new Date(parseInt(input, 10) || 0);
                }

                if($.type(input) === 'date') {
                    return new Date(+input);
                }

                var date = new Date(0, 0);
                var parts = input.match(rNonpunctuation);
                if(!parts || !parts.length) {
                    throw new Error('Date parse error.');
                }

                var ftParts = Datepicker.parseFormat(format).parts;
                $.each(parts, function(i, val) {
                    val = parseInt(val, 10);

                    var type = ftParts[i];
                    if(type && !isNaN(val) && parseFns[type]) {
                        parseFns[type](date, val);
                    }
                });

                return date;
            },
            getTimezoneCoverter: getTimezoneCoverter,
            toLocaleDate: getTimezoneCoverter('Locale'),
            toUTCDate: getTimezoneCoverter('UTC'),

            // fns
            padNumber: padNumber
        };
    })());

    // config & tmpl
    $.extend(Datepicker, {
        defaultOptions: module ? $.extend(true, defaultOptions, module.config()) : defaultOptions,
        template: '<div class="datepicker-days hide"><table class="table-condensed"><thead><tr class="date-header"><th class="prev"><b></b></th><th colspan="5" class="datepicker-switch"></th><th class="next"><b></b></th></tr><tr class="week-content"></tr></thead><tbody></tbody><tfoot class="hide"><tr><th colspan="7" class="today"></th></tr><tr><th colspan="7" class="clear"></th></tr></tfoot></table><div class="timepicker-container hide">{timepicker}</div></div><div class="datepicker-months hide"><table class="table-condensed"><thead><tr class="date-header"><th class="prev"><b></b></th><th colspan="5" class="datepicker-switch"></th><th class="next"><b></b></th></tr></thead><tbody><tr><td colspan="7"></td></tr></tbody><tfoot class="hide"><tr><th colspan="7" class="today"></th></tr><tr><th colspan="7" class="clear"></th></tr></tfoot></table></div><div class="datepicker-years hide"><table class="table-condensed"><thead><tr class="date-header"><th class="prev"><b></b></th><th colspan="5" class="datepicker-switch"></th><th class="next"><b></b></th></tr></thead><tbody><tr><td colspan="7"></td></tr></tbody><tfoot class="hide"><tr><th colspan="7" class="today"></th></tr><tr><th colspan="7" class="clear"></th></tr></tfoot></table></div>',
        timepickerTemplate: '<div class="timepicker timepicker-in-datepicker"><div class="picker-wrap" data-role="hour"><a href="javascript:;" class="picker-btn up"><b class="arrow"></b><b class="arrow-bg"></b></a><div class="picker-con"><div class="picker-innercon picker-innercon-hours"></div></div><a href="javascript:;" class="picker-btn down"><b class="arrow"></b><b class="arrow-bg"></b></a></div><div class="picker-wrap" data-role="minute"><a href="javascript:;" class="picker-btn up"><b class="arrow"></b><b class="arrow-bg"></b></a><div class="picker-con"><div class="picker-innercon picker-innercon-minutes"></div></div><a href="javascript:;" class="picker-btn down"><b class="arrow"></b><b class="arrow-bg"></b></a></div><div class="timePicker-split"><div class="hour-input"><input type="text" name="hour" value="00" maxlength="2"></div><div class="split-icon">:</div><div class="minute-input"><input type="text" name="minute" value="00" maxlength="2"></div></div></div>'
    });

    // hook
    $.extend(Datepicker, (function() {
        var hooksCache = {};

        return {
            addHook: function(type, callback) {
                var hooks = hooksCache[type];
                if(!hooks) {
                    hooks = hooksCache[type] = [];
                }

                hooks.push(callback);
            },
            removeHook: function(type, callback) {
                var hooks = hooksCache[type];
                if(!hooks) {
                    return;
                }

                if(!callback) {
                    hooksCache[type] = [];
                    return;
                }

                for(var i=hooks.length-1; i>=0; --i) {
                    if(val === callback) {
                        hooks.splice(i, 1);
                    }
                }
            },
            runHook: function(type) {
                var args = slice.call(arguments, 1);
                var hooks = hooksCache[type];
                var outRet = {};

                if(hooks && hooks.length) {
                    $.each(hooksCache[type], function(i, hook) {
                        var ret = hook.apply(null, args);

                        if(!$.isPlainObject(ret)) {
                            return;
                        }

                        $.each(ret, function(k, val) {
                            if(!outRet[k]) {
                                outRet[k] = val;
                            }
                            else {
                                outRet[k] += val;
                            }
                        });
                    });
                }

                return outRet;
            }
        };
    })());

    // default hooks
    if(module && defaultOptions.hooks) {
        var hookId = defaultOptions.hooks;
        if(hookId.indexOf('/') !== 0 && !/^https?:/.test(hookId)) {
            var hookPrefix = module.id.replace('jquery.datepicker', '');
            hookId = hookPrefix + hookId;
        }

        require([hookId], function(hooks) {
            $.each(hooks || [], function(k, hook) {
                Datepicker.addHook(k, hook);
            });
        });
    }

    // DateRangePicker
    function DateRangePicker(options) {
        var self = this;
        var target = this.target = $(options.target);

        var inputs = this.inputs = $.map(options.inputs, function(item) {
            return item.jquery ? item[0] : item;
        });
        delete options.inputs;

        $(inputs).datepicker(options);

        this.pickers = $.map(inputs, function(inp) {
            return $.data(inp, 'datepicker');
        });

        target.on('change', function(e) {
            var inx = $.inArray(e.target, inputs);
            if(inx < 0) {
                return;
            }

            self.updateDates(inx);
        });

        this.updateDates();
    }
    $.extend(DateRangePicker.prototype, {
        updateDates: function(pickerInx) {
            var pickers = this.pickers;
            var changePicker = pickers[pickerInx];
            var changeMs = changePicker && +changePicker.getDate();

            this.dates = $.map(pickers, function(picker, i) {
                var ms = picker.getDate().getTime();

                if(
                    changePicker && (
                        pickerInx > i && changeMs < ms ||
                        pickerInx < i && changeMs > ms
                    )
                ) {
                    picker.setDate(changeMs);
                }

                return picker.getDate();
            });

            this.setRange(this.dates);
        },
        setRange: function(range) {
            if(range && range.length) {
                $.each(this.pickers, function(i, picker) {
                    picker.setRange(range);
                });
            }

            return this;
        },
        show: function() {
            var picker = this.pickers[0];
            if(picker) {
                picker.show();
            }

            return this;
        },
        hide: function() {
            $.each(this.pickers, function(i, picker) {
                picker.hide();
            });

            return this;
        },
        destroy: function() {
            $.each(this.pickers, function(i, picker) {
                picker.destroy();
            });
        }
    });

    // Export
    $.Datepicker = Datepicker;
    $.DateRangePicker = DateRangePicker;
    $.fn.datepicker = function(options) {
        var args = slice.call(arguments, 1);
        var optionsType = $.type(options);
        var outRet;

        this.each(function() {
            var self = $(this);
            var picker = self.data('datepicker');

            if(!picker) {
                var ops = getOptionsFromElement(self);

                if(optionsType === 'object') {
                    ops = $.extend(ops, options);
                }
                ops.target = this;

                if(ops.inputs || self.hasClass('input-daterange')) {
                    if(!ops.inputs) {
                        ops.inputs = self.find('input').toArray();
                    }

                    picker = new DateRangePicker(ops);
                }
                else {
                    picker = new Datepicker(ops);
                }

                self.data('datepicker', picker);
            }

            if(
                optionsType === 'string' &&
                typeof picker[options] === 'function'
            ) {
                outRet = picker[options].apply(picker, args);
                if(outRet !== undefined) {
                    return false;
                }
            }
        });

        return outRet !== undefined ? outRet : this;
    };

    // getOptionsFromElement
    function getOptionsFromElement(elem) {
        var ops = {};
        var prefix = 'date';
        var data = elem.data();

        function toLower(a, b) {
            return b.toLowerCase();
        }

        $.each(data, function(k, val) {
            if(k.indexOf(prefix) !== 0) {
                return;
            }

            var re = new RegExp('^' + prefix + '([\\w])');
            k = k.replace(re, toLower);
            ops[k] = val;
        });

        return ops;
    }

    // fill
    function fill(tmpl, data) {
        for(var k in data) {
            tmpl = tmpl.replace(new RegExp('\\{'+ k +'\\}', 'g'), data[k]);
        }
        return tmpl;
    }

    return Datepicker;
}));
