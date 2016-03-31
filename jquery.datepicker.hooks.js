/**
 * jquery.datepicker.hooks
 *
 * @author xiaomi
 * @update 2015.01.10
 */

define(['jquery', './jquery.datepicker'], function($, Datepicker) {
    var dayFormat = 'yyyy-MM-dd';

    // holidays 节假日
    // 农历未计算，采用枚举，目前支持到 2020 年
    var holidays = {
        yuandan: /01-01$/,
        qingren: /02-14$/,
        funv: /03-08$/,
        laodong: /05-01$/,
        ertong: /06-01$/,
        jiaoshi: /09-10$/,
        guoqing: /10-01$/,
        shuangshiyi: /11-11$/,
        shuangshier: /12-12$/,
        pinganye: /12-24$/,
        shengdan: /12-25$/,
        // 农历
        chunjie: [
            '2015-02-19',
            '2016-02-08',
            '2017-01-28',
            '2018-02-16',
            '2019-02-05',
            '2020-01-25'
        ],
        qingming: [
            '2015-04-05',
            '2016-04-04',
            '2017-04-04',
            '2018-04-05',
            '2019-04-05',
            '2020-04-04'
        ],
        duanwu: [
            '2015-06-20',
            '2016-06-09',
            '2017-05-30',
            '2018-06-18',
            '2019-06-07',
            '2020-06-25'
        ]
    };

    // array => object map
    $.each(holidays, function(k, fn) {
        if($.type(fn) === 'array') {
            var map = {};

            $.each(fn, function(i, val) {
                map[val] = true;
            });

            holidays[k] = map;
        }
    });

    // 母亲节、父亲节、感恩节 （周相关）
    (function() {
        var count = 10;

        function createDayByWeek(name, date, month, weekTh, weekDay) {
            date.setMonth(month - 1);
            date.setDate(1);

            var day = date.getDay();
            var offset = 1 + 7 * (weekTh + 1);

            if(weekDay > 0 || day <= 0) {
                weekDay += 7;
            }

            day = offset - day - weekDay;
            date.setDate(day);

            var ftDate = Datepicker.formatDate(date, dayFormat);
            if(!holidays[name]) {
                holidays[name] = {};
            }

            holidays[name][ftDate] = true;
        }

        var date = new Date();
        var startYear = date.getFullYear();

        for(var i=0; i<count; ++i) {
            date.setFullYear(startYear + i);

            // 母亲节， 5月第一个周日
            createDayByWeek('muqin', date, 5, 1, 0);

            // 父亲节， 6月第二个周日
            createDayByWeek('fuqin', date, 6, 2, 0);

            // 感恩节，11月第四个星期四
            createDayByWeek('ganen', date, 11, 4, 3);
        }
    })();

    // 春节 相关计算
    $.each(holidays.chunjie, function(ftDate) {
        var date = Datepicker.parseDate(ftDate, dayFormat);

        // 除夕
        date.setDate(date.getDate() - 1);

        var chuxi = holidays.chuxi || (holidays.chuxi = {});
        chuxi[Datepicker.formatDate(date, dayFormat)] = true;

        // 元宵节
        date.setDate(date.getDate() + 15);

        var yuanxiao = holidays.yuanxiao || (holidays.yuanxiao = {});
        yuanxiao[Datepicker.formatDate(date, dayFormat)] = true;
    });

    return {
        day: function holidayHook(date, fillData) {
            var formattedDate = Datepicker.formatDate(date, dayFormat);

            var holiday;
            $.each(holidays, function(k, fn) {
                var type = $.type(fn);

                if(
                    type === 'object' && fn[formattedDate] ||
                    type === 'regexp' && fn.test(formattedDate) ||
                    type === 'function' && fn.call(null, date, fillData)
                ) {
                    holiday = k;
                    return false;
                }
            });

            return holiday ? {
                className: 'holiday',
                content: '<i class="icon '+ holiday +'"></i>'
            } : null;
        }
    };
});