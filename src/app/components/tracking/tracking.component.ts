import { Component, OnDestroy, OnInit } from '@angular/core';
import { DashboardComponent }  from './dashboard/dashboard.component';
import { ActivityComponent }    from './activity/activity.component';
import { TimerService } from '../../services/timer.service'
import { DataService } from '../../services/data.service'
import { DatabaseService } from '../../services/database.service'
import { ApiService } from '../../services/api.service'
import { SecondsToTimePipe } from '../../pipes/seconds-to-time.pipe'
import { ToasterService } from '../../services/toaster.service'

import { Router } from '@angular/router';
import { WorkItemData } from 'app/models/RemoteAccount';
const notifier = require('electron-notifications')
const path = require('path')

@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.scss']
})
export class TrackingComponent implements OnDestroy, OnInit {
  public notificationTime: number
  public issueTime: number
  private allItemsFromDb: any
  public unstoppedItem: any
  public notificationText: string
  alive: boolean = true;
  public agilesStates: Array<any>
  public hintsCheckbox: boolean
  public hideHints: number
  secondsToTimePipe = new SecondsToTimePipe()
  public dbVariables: object

  constructor(
    public timerService: TimerService,
    public dataService: DataService,
    public databaseService: DatabaseService,
    public api: ApiService,
    public router: Router,
    public toasterService: ToasterService
  ) { }

  ngOnInit() {
    this.subscribeNotificationTime()
    this.subscribeIssueTime()
    this.subscribeUnstoppedItem()
    this.subscribeAgilesStates()
    this.getVariables()
  }

  ngOnDestroy() {
    this.alive = false
  }

  subscribeNotificationTime() {
    this.dataService.currentNotificationTime.takeWhile(() => this.alive).subscribe(data => {
      console.log(data)
      this.notificationTime = data
      if (this.notificationTime != undefined) {
        this.showInactiveNotification()
      }
    })
  }

  subscribeIssueTime() {
    this.dataService.currentIssueTime.takeWhile(() => this.alive).subscribe(data => {
      let issueTime = data["currentTime"]
      console.log("TAKE", data)
      if (issueTime % 60 === 0) {
        this.databaseService.updateDuration(Math.round(issueTime), this.timerService.currentIssue.startDate)
      }
      if (this.timerService.currentIssue) {
        let element = document.getElementById('current-item') 
        element.className = "show"
        let content = document.getElementById('content')
        content.className = "content decrease"
      }
    })
  }

  subscribeUnstoppedItem() {
    this.dataService.currentUnstoppedItem.takeWhile(() => this.alive).subscribe(data => {
      this.unstoppedItem = data
      if (Object.keys(this.unstoppedItem).length != 0) {
        this.showModal()
      }
      console.log("unstoppedItem observble", this.unstoppedItem)
    })
  }

  public subscribeAgilesStates() {
    let that = this
    this.agilesStates = []
    this.dataService.agilesStates.takeWhile(() => this.alive).subscribe(currentAgile => {
      if (Object.keys(currentAgile).length > 0) {
        this.agilesStates.push(currentAgile)
      }
      this.agilesStates.forEach(agile => {
       (agile.name == currentAgile["name"])? agile.state = currentAgile["state"] : ""
      })
      this.agilesStates = this.agilesStates.filter((thing, index, self) => 
        index === self.findIndex((t) => (
          t.name === thing.name
        ))
      )
      console.log("this.agilesStates", this.agilesStates)
      this.dataService.sendCurrentAgilesVisibility(this.agilesStates)
    })
  }

  public manageUnstoppedItem = (action) => {
    var item = new WorkItemData;
    item.issueId = this.unstoppedItem.issueid
    item.duration = this.unstoppedItem.duration
    item.date = Date.now();
    item.startDate = this.unstoppedItem.date,
    item.summary = this.unstoppedItem.Summary
    if (action == 'remove') {
      this.databaseService.deleteItem(item.startDate)
      this.hideModal()
      this.toasterService.showToaster('Your tracking has been removed!', 'default')
    }
    if (action == 'resume') {
      this.timerService.startItem(item);
      this.hideModal()
      document.getElementById('modal').style.display = "none"
    }
    if (action == 'add') {
      this.api.createNewWorkItem(item).then(data => {
        this.databaseService.stopItem(item.duration, item.startDate)
        this.databaseService.setIsPublished(item.startDate)    
        this.hideModal()             
        this.toasterService.showToaster('Your tracking has been saved!', 'default')  
      })      
    }
    this.unstoppedItem = undefined
  }

  public stopTracking = (item) => {
    this.timerService.stopItem()
  }

  public goToEditAccount() {
    this.router.navigate(['edit-account'])
  }

  public showInactiveNotification() {
    const notification = notifier.notify('You were inactive', {
      message: 'What should I do with ' + this.secondsToTimePipe.transform(this.timerService.notificationTime) + '?',
      buttons: ['Add', 'Remove'],
      icon: path.resolve(__dirname, 'assets/icons/favicon.png'),
      duration: 60000
    })
    notification.on('swipedRight', () => {
      notification.close()
    })
    notification.on('buttonClicked', (text, buttonIndex, options) => {
      if (text === 'Remove') {
        this.timerService.shouldAddAfkTime(false)
      }
      notification.close()
    })
  }

  public getVariables() {
    this.databaseService.getVariables().then(data => {
      console.log("data", data)
      if (data) {
        this.hideHints = parseInt(data["value"])
        this.dataService.sendHideHints(this.hideHints)
        console.log("this.hideHints", this.hideHints)
      }
    })
  }

  public changeHintVisibility(hideHint) {
    (hideHint)? hideHint = 1: hideHint = 0
    this.databaseService.updateVariable({name: 'hide_hints', value: hideHint})
    console.log("changeHintVisibility", hideHint)
  }

  public showModal() {
    document.getElementById('modal').style.display = "block"
  }

  public hideModal() {
    document.getElementById('modal').style.display = "none"
    this.getVariables()
  }

}
