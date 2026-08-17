@App-WMS
Feature: WMS Smart Client - Smoke Tests
  As a warehouse operator
  I want to verify the WMS Smart Client launches and authenticates
  So that I can confirm the ClickOnce deployment is functional

  Background:
    Given the WMS Smart Client is launched

  Scenario: Login to WMS Smart Client
    * Fill input usernameInput on the LoginPage with text: CONTEXT-username
    * Fill input passwordInput on the LoginPage with text: CONTEXT-password
    * Click the loginButton on the LoginPage
    * Wait 20 seconds
    * Reattach to the WMS application
    * If present, click the okButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Warehouse
    * Fill input usernameInput on the LoginPage with text: CONTEXT-username
    * Fill input passwordInput on the LoginPage with text: CONTEXT-password
    * Click the loginButton on the LoginPage
    * Wait 20 seconds
    * Reattach to the WMS application
    * If present, click the okButton on the ChangeUserSettingsPage
    * Click the warehouseButton on the LeftPanelMenuPage
    * If present, click the okButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Warehouse Gateway
    * Fill input usernameInput on the LoginPage with text: CONTEXT-username
    * Fill input passwordInput on the LoginPage with text: CONTEXT-password
    * Click the loginButton on the LoginPage
    * Wait 20 seconds
    * Reattach to the WMS application
    * If present, click the okButton on the ChangeUserSettingsPage
    * Click the warehouseGatewayButton on the LeftPanelMenuPage
    * If present, click the okButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Transportation
    * Fill input usernameInput on the LoginPage with text: CONTEXT-username
    * Fill input passwordInput on the LoginPage with text: CONTEXT-password
    * Click the loginButton on the LoginPage
    * Wait 20 seconds
    * Reattach to the WMS application
    * If present, click the okButton on the ChangeUserSettingsPage
    * Click the transportationButton on the LeftPanelMenuPage
    * If present, click the okButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Output Manager
    * Fill input usernameInput on the LoginPage with text: CONTEXT-username
    * Fill input passwordInput on the LoginPage with text: CONTEXT-password
    * Click the loginButton on the LoginPage
    * Wait 30 seconds
    * Reattach to the WMS application
    * If present, click the okButton on the ChangeUserSettingsPage
    * Click the outputManagerButton on the LeftPanelMenuPage
    * If present, click the okButton on the ChangeUserSettingsPage
