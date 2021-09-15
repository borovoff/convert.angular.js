// Please covert project to Typescript
// ==============================================================
//
// 1.enumerable libraries should be transformed into javascript array functions
// 2.api calls accessed through services should be replaced with our generated library functions
// 3.controllers should be typed
// 4.no typescript warnings must be present in the operators folder
//
// ==============================================================
import * as angular from 'angular';
import {IQService, IScope} from 'angular';
import {CompanyUserGroupResponse} from './models/company-user-group-response';
import {DataService} from './services/data.service';
import {OperatorGroupsResponse} from './models/operator-groups-response';
import {SaveOperatorResponse} from './models/save-operator-response';
import {OperatorService} from './services/operator.service';
import {SecurityService} from './services/security.service';
import {ScreenLocker} from './services/screen-locker';
import {NotificationService} from './services/notification.service';
import {Operator} from './models/operator';
import {OperatorGroup} from './models/operator-group';
import {User} from './models/user';

declare global {
    interface Window {
        globalSettings: {
            apiUrl: string
        }
    }
}

interface OperatorCreateScope extends IScope {
    companySpaceCode: string;
    companyCode: string;
    userCode: string;
}

interface OperatorCreateController {
    userList: User[]
    selectedCompanySpaceCode: string
    operator: Operator
    operatorGroups: OperatorGroup[]
    selectedOperatorGroup: OperatorGroup
    save: () => void
    back: () => void
}

(function (module) {
    const operatorCreateController = function (
        this: OperatorCreateController,
        $q: IQService,
        $scope: OperatorCreateScope,
        dataService: DataService,
        notificationService: NotificationService,
        operatorsService: OperatorService,
        screenLocker: ScreenLocker,
        securityService: SecurityService
    ) {
        const vm = this;

        if (!securityService.getIsAuthenticated()) return;

        const companySpaceCode = $scope.companySpaceCode;
        const companyCode = $scope.companyCode;

        operatorsService.setSelectedCompanySpaceCode(companySpaceCode);
        operatorsService.setSelectedCompanyCode(companyCode);

        vm.userList = [];
        vm.selectedCompanySpaceCode = companySpaceCode;

        vm.operator = {
            description: null,
            operator: {
                userCode: $scope.userCode,
                canDeleteUnfinished: true,
            },
            version: null,
            code: null,
        };

        function loadData() {
            dataService
                .get<CompanyUserGroupResponse>(
                    window.globalSettings.apiUrl + 'admin/company/' + companyCode + '/usergroups?include=users&include=authorizations')
                .then(response => {
                    response.data.forEach(function (group) {
                        if (group.users && (group.name === 'Operator' || group.name === 'History Viewer')) {
                            group.users.forEach(function (user) {
                                user.displayName = user.name + ' (' + group.name + ')';
                                vm.userList.push(user);
                            });
                        }
                    });

                    return dataService.get<OperatorGroupsResponse>(
                        window.globalSettings.apiUrl + 'admin/operatorRoots?companySpaceReference=' + vm.selectedCompanySpaceCode);
                })
                .then(response => {
                    vm.operatorGroups = response.data.filter(({ operatorGroup }) => operatorGroup != null)
                    vm.selectedOperatorGroup = vm.operatorGroups[0];
                })
                .catch(error => {
                    console.error(error);
                    notificationService.error('Error during getting accounts or operators groups');
                });
        }

        loadData();

        vm.save = function () {
            if (!vm.operator.description) {
                notificationService.error("You must specify operator's name");
                return;
            }
            if (!vm.operator.operator.userCode) {
                notificationService.error("You must specify operator's Account");
                return;
            }

            screenLocker.lock();
            dataService
                .post<SaveOperatorResponse>(
                    window.globalSettings.apiUrl + 'admin/operatorRoots?companySpaceReference=' + vm.selectedCompanySpaceCode,
                    vm.operator
                )
                .then(response => {
                    let groupChain = $q.when();
                    const operatorCode = response.data.code;
                    for (let i = 0; i < vm.operatorGroups.length; i++) {
                        if (vm.operatorGroups[i].$$selected) {
                            (function (index) {
                                groupChain = groupChain.then(function () {
                                    return dataService.post(
                                        window.globalSettings.apiUrl +
                                        'admin/operatorRoot/' +
                                        vm.operatorGroups[index].code +
                                        '/children?childReference=' +
                                        operatorCode +
                                        '&version=' +
                                        encodeURIComponent(vm.operatorGroups[index].version)
                                    );
                                });
                            })(i); // to avoid closure on i
                        }
                    }
                    return groupChain;
                })
                .then(() => {
                    notificationService.success('Operator created');
                    closeCreate();
                })
                .catch(error => {
                    console.error(error);
                    notificationService.error('Error during sending user to server');
                })
                .finally(() => {
                    screenLocker.unlock();
                });
        };

        function closeCreate() {
            $scope.$emit('operatorCreateStopped');
        }

        vm.back = function () {
            closeCreate();
        };
    };

    const pxOperatorCreate = function () {
        return {
            restrict: 'E',
            template: '',
            controller: ['$q', '$scope', 'dataService', 'notificationService', 'operatorsService', 'screenLocker', 'securityService', operatorCreateController],
            controllerAs: 'vm',
            scope: {
                companyCode: '=',
                companySpaceCode: '=',
                userCode: '=',
            },
            replace: true,
        };
    };
    module.directive('pxOperatorCreate', pxOperatorCreate);
})(angular.module('proceedix.operators'));
